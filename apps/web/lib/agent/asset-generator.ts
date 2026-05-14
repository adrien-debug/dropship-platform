import { promises as fs } from 'fs';
import path from 'path';
import { runWorkflow, isComfyConfigured } from './comfy-client';
import { falGenerateImage, falGenerateVideo, isFalConfigured } from './fal-client';
import { extractJson } from './json';
import { trackedMessage } from './anthropic';
import { isR2Configured, uploadToR2 } from '@/lib/storage/r2';
import { getDb } from '@/lib/db';

/**
 * Auto-generates hero/cutout/lifestyle/promo-video assets for a mono-product
 * store, given the product's reference image (the cleanest supplier shot we
 * could find).
 *
 * Storage strategy (decided at runtime via env):
 *
 *   1. **R2 (preferred, prod)** — when `isR2Configured()` is true (all five
 *      R2_* env vars set), assets are uploaded to Cloudflare R2 under
 *      `{slug}/run-{ts}/{filename}` and the DB stores the absolute public
 *      URL (`https://pub-...r2.dev/...`). Survives redeploys; works on
 *      Vercel where `public/` is read-only at runtime.
 *
 *   2. **Filesystem (fallback, dev)** — when R2 isn't configured we keep
 *      writing to `apps/web/public/generated/{slug}/run-{ts}/` exactly as
 *      before, with a `current/` symlink for the storefront to consume.
 *      Useful for local dev when no R2 credentials are around.
 *
 * Output layout (filesystem mode, kept for parity):
 *
 *   apps/web/public/generated/{slug}/run-{ts}/
 *     hero.png           (~5500×3072, flux-pro/v1.1-ultra + clarity 2× upscale)
 *     cutout.png         (1024×576, kontext on supplier ref — for ProductShowcase)
 *     lifestyle-1.png    (1024×576, kontext, in-context shot)
 *     lifestyle-2.png    (1024×576, kontext, alt context)
 *     lifestyle-3.png    (1024×576, kontext, alt context)
 *     promo.mp4          (5s, 1080×1920 vertical, image-to-video)
 *
 *   apps/web/public/generated/{slug}/current        (symlink → latest run-*)
 *
 * In R2 mode there is no `current/` pointer — the DB row holds the resolved
 * absolute URL of the latest run, so "which run is current" is answered by
 * `dropship_stores.hero_image_url` directly. Old runs stay in the bucket as
 * historical archives (cleaned by a P1 sweep job if/when storage grows).
 *
 * Workflow IDs come from env. If COMFY_BACKEND isn't configured we no-op
 * gracefully so the agent still produces a working store using only the
 * supplier image.
 */

export interface AssetGenInput {
  /** Required so each generation step is traced into `dropship_asset_runs`. */
  storeId: string;
  storeSlug: string;
  /** The product the agent already picked (highest-quality supplier image). */
  product: { title: string; description: string; imageUrl: string };
  /** Tone words: "cinematic", "minimal", "editorial". Drives prompt phrasing. */
  niche: string;
  /** "fr" | "en" — only affects prompt language for Claude. Generation is en-only. */
  language?: 'fr' | 'en';
  /** Skip video generation (faster, cheaper). Default false. */
  skipVideo?: boolean;
  /**
   * Locked design context — when provided, the prompt builder steers FLUX
   * toward imagery that matches the storefront's typography mood + palette.
   * The brand colors here are recommendations to FLUX (atmosphere, accent
   * lighting), not literal overlays. The reference image still drives the
   * actual product appearance.
   */
  design?: {
    presetSlug: string;
    /** One-line mood string sourced from `lib/design/presets.ts → imageryMood`. */
    imageryMood: string;
    primaryColor: string;
    accentColor: string;
  };
}

export interface AssetGenOutput {
  runId: string;
  /**
   * URL to the generated asset. In R2 mode this is an absolute https URL
   * (`https://pub-....r2.dev/{slug}/run-{ts}/hero.png`). In filesystem mode
   * it's a web-rooted path (`/generated/{slug}/run-{ts}/hero.png`). The
   * storefront renders both via raw `<img src>` — no UI branching needed.
   * Null when generation was skipped or failed for that asset.
   */
  heroUrl: string | null;
  cutoutUrl: string | null;
  lifestyleUrls: string[];
  promoVideoUrl: string | null;
  /** Issues encountered during generation, surfaced in the SSE log. */
  warnings: string[];
  /** Hard errors per asset step (subset of warnings, parsed for the activation gate). */
  errors: string[];
}

interface PromptBundle {
  hero: string;
  cutout: string;
  lifestyles: string[]; // 3 entries
  promo: string; // image-to-video motion description
}

export const FALLBACK_PROMPTS: PromptBundle = {
  hero: 'Cinematic editorial product photograph, full-bleed 16:9 composition, the product placed within a fully new studio set: brushed concrete floor, soft north-window light, deep negative space, 35mm shallow depth of field, premium DTC brand aesthetic, no text',
  cutout: 'Single product floating on a deep charcoal-to-black studio gradient, soft rim light from upper-right, one quiet contact shadow, e-commerce hero PNG style, no other objects, no people, no horizon, no text',
  lifestyles: [
    'Morning ritual on a pale oak bathroom counter, cold north-window light, white linen towel out of focus in the background, 50mm macro feel, premium editorial photograph, no text',
    'Outdoor weekend moment on wet sand at golden hour, soft long shadow stretching across the frame, distant horizon blurred, 35mm shallow depth of field, cinematic warm light, no text',
    'Evening on a dark walnut dinner table beside a single brass candle, warm tungsten light reflecting on the product, magazine-style overhead 45° angle, no text',
  ],
  promo: 'Five-second continuous take, slow 30mm dolly push-in toward the product, one subtle ambient shift (light warming or steam drifting past), single light source, no cuts, no text',
};

async function buildPromptsWithClaude(input: AssetGenInput): Promise<PromptBundle> {
  if (!process.env.ANTHROPIC_API_KEY) return FALLBACK_PROMPTS;

  try {
    const res = await trackedMessage({ step: 'asset-prompts' }, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an art director writing prompts for FLUX Kontext. Kontext takes a single product reference image and re-composes the SAME product into a brand-new generated scene. The reference is preserved at the pixel level for the product; everything else (lighting, background, surrounding objects, camera, mood) is fully regenerated from your prompt.

Product: "${input.product.title}"
Niche: "${input.niche}"
Description excerpt: "${input.product.description.slice(0, 300)}"
${
  input.design
    ? `
Brand design system (locked — every asset must visually match the storefront):
- Mood: ${input.design.imageryMood}
- Primary brand color: ${input.design.primaryColor} (use as the dominant scene tone — wall paint, sky tint, fabric, surface — NOT painted onto the product itself)
- Accent brand color: ${input.design.accentColor} (one small punctuation element: a single flower, fruit, sweater, fabric square in the corner, glow of a window — used sparingly to tie the scene to the brand)
- Preset reference: ${input.design.presetSlug}
`
    : ''
}

Write FLUX prompts for a premium DTC landing page (think Apple, Dyson, Bose, On Running). Hard rules:

1. ENGLISH ONLY. FLUX is anglophone.
2. NEVER reuse the reference's original background. Each prompt must describe a freshly imagined scene — new walls, new floor, new sky, new light. Treat the reference as a die-cut sticker of the product to drop into a new world.
3. NO text, badges, labels, prices, watermarks, signage, logos, or written words anywhere in the scene. Never write the word "text" in the prompt.
4. The product itself stays photorealistic and IDENTICAL to the reference — same colorway, same proportions, same materials.
5. Each scene must read as a different moment with a distinct camera, light, location and atmosphere. Aim for editorial photography variety, not a colorway pack.
6. Specify camera (35mm, 50mm, macro), light (golden hour, cold north window, warm tungsten, cinematic rim), surface (oak counter, brushed concrete, white linen, wet sand), depth-of-field, and a one-line mood tag.

Hero specifics — this is the FIRST FRAME the visitor sees, push the quality up:
- Magazine-cover quality. Editorial 35mm or 50mm photograph, sharp rim light, controlled shadow, balanced negative space, the product placed off-center on a thirds line. Reads crisp at 100% zoom on a 4K screen.
- INCLUDE THE END-USER as the primary subject when the product is used ON or BY a living thing. The product is in service of someone — show them.
    • dog/cat product → show a real dog or cat (the right breed for the niche), product visible and being used
    • baby/toddler product → show a baby (face mostly out-of-frame for privacy, hands or feet visible)
    • skincare / beauty → show a hand, face, or shoulder where the product is applied
    • shoes / fitness wear → show the body part wearing the item
    • cookware / kitchen → show hands using it
    • office / desk → show hands or workspace context
    A pure studio shot of the bare product belongs in the CUTOUT, not the hero. The hero must answer "who is this for?" in one glance.
- No filter words ("soft", "dreamy", "hazy") — they push the image grey. Prefer sharp / polished / cinematic / serene.
- Daylight or one strong directional source, not flat ambient.
- No darkening at the edges, no heavy vignette — we don't want to dim the photo with CSS afterwards.

Cutout specifics:
- The cutout is the e-commerce hero, used like a PNG. The product floats on a clean dark studio gradient with a soft rim light and a single contact shadow. No other objects, no props, no people, no horizon line.

Lifestyle specifics:
- Three lifestyles, in three radically different contexts. Avoid all three being "indoors at home". Pick from: morning ritual, weekend outdoor, evening dinner moment, gym/active, hotel/travel, café/work, garden, bathroom counter — match the niche.

Promo specifics:
- Image-to-video motion. Single continuous take, 5 seconds, slow camera move (push-in, dolly, parallax), one light shift or one secondary subtle motion (steam, fabric ripple). No cuts. No text.

Return ONLY this JSON, no preamble, no commentary:
{
  "hero": "<one full-bleed cinematic prompt, 16:9, editorial mood, product clearly featured but composed within a fully new scene>",
  "cutout": "<one prompt: product centered on dark studio gradient, no other objects, no text>",
  "lifestyles": [
    "<context A — concrete location + camera + light>",
    "<context B — different location, different time of day, different camera>",
    "<context C — different location again, different vibe>"
  ],
  "promo": "<5-second motion description: camera move + one ambient shift + product anchor>"
}`,
        },
      ],
    });

    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const parsed = extractJson<Partial<PromptBundle>>(text);
    if (!parsed) return FALLBACK_PROMPTS;

    return {
      hero: parsed.hero || FALLBACK_PROMPTS.hero,
      cutout: parsed.cutout || FALLBACK_PROMPTS.cutout,
      lifestyles:
        Array.isArray(parsed.lifestyles) && parsed.lifestyles.length === 3
          ? parsed.lifestyles
          : FALLBACK_PROMPTS.lifestyles,
      promo: parsed.promo || FALLBACK_PROMPTS.promo,
    };
  } catch {
    return FALLBACK_PROMPTS;
  }
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeAsset(absDir: string, filename: string, bytes: Buffer): Promise<string> {
  const abs = path.join(absDir, filename);
  await fs.writeFile(abs, bytes);
  return abs;
}

/**
 * Re-point public/generated/{slug}/current at the new run dir. Symlink on
 * Unix; on Windows we'd need a junction — out of scope for the production
 * Linux deploy on Vercel. Only used in filesystem mode (R2 mode stores the
 * absolute URL of each run directly in the DB, so a "current" pointer is
 * redundant).
 */
async function repointCurrent(storeRoot: string, runDirName: string) {
  const current = path.join(storeRoot, 'current');
  try {
    await fs.rm(current, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    await fs.symlink(runDirName, current, 'dir');
  } catch (e) {
    // Fallback if symlinks aren't allowed: copy the run dir.
    console.warn('[asset-generator] symlink failed, falling back to copy', e);
    await fs.cp(path.join(storeRoot, runDirName), current, { recursive: true });
  }
}

/**
 * Mime type for a generated asset filename. Limited to the three formats the
 * ComfyUI pipeline can emit today; defaulting elsewhere would force browsers
 * to download rather than render inline.
 */
function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  return 'application/octet-stream';
}

/**
 * Resolve a per-asset deployment pool from env. The raw value may be a
 * single id (`dep_a`) or a comma-separated round-robin list
 * (`dep_a,dep_b,dep_c`). Falls back to the global `COMFY_DEPLOYMENT_IDS` /
 * legacy `COMFY_DEPLOYMENT_ID` resolution inside the client when this key
 * is unset, so callers don't have to know the override chain.
 */
function envPool(deploymentEnvKey: string): string | undefined {
  const raw = process.env[deploymentEnvKey];
  if (!raw || !raw.trim()) return undefined;
  return raw;
}

/**
 * Run an image workflow on the deployment pool resolved from `deploymentEnvKey`
 * (e.g. `COMFY_DEPLOYMENT_HERO`). Returns the raw image bytes plus the comfy
 * run id so callers can persist it in the asset history.
 *
 * Exported so the regenerator can reuse the same workflow plumbing without
 * duplicating the env-resolution + negative-prompt boilerplate.
 */
export async function runImage(
  deploymentEnvKey: string,
  prompt: string,
  refImageUrl: string,
): Promise<{ bytes: Buffer; runId: string }> {
  // fal.ai fallback: when ComfyUI isn't configured (no deployment IDs) but
  // FAL_KEY is, route the call to fal.ai. Keeps the asset pipeline working
  // out-of-the-box without requiring users to host their own ComfyUI Deploy
  // workflows. Falls back transparently — the rest of the pipeline doesn't
  // know which backend produced the bytes.
  const deploymentId = envPool(deploymentEnvKey);
  // Hero gets the higher-quality fal.ai preset (more steps, slightly
  // higher guidance, PNG). The cost delta is a few cents per image —
  // worth it for the first frame the visitor ever sees.
  const isHero = /HERO/i.test(deploymentEnvKey);
  if (!deploymentId) {
    if (isFalConfigured()) {
      const bytes = await falGenerateImage({
        prompt,
        referenceImageUrl: refImageUrl,
        quality: isHero ? 'hero' : 'standard',
      });
      return { bytes, runId: `fal-${Date.now()}` };
    }
    throw new Error(`${deploymentEnvKey} not set (and no FAL_KEY fallback)`);
  }
  const result = await runWorkflow({
    deploymentId,
    inputs: {
      prompt,
      reference_image: refImageUrl,
      negative_prompt: 'text, watermark, logo, label, badge, price, discount, sale, signage, lettering, typography',
    },
  });
  if (!result.images.length) throw new Error('no image returned');
  return { bytes: result.images[0]!, runId: result.runId };
}

/**
 * Run the 5-second image-to-video workflow. Same env-pool resolution as
 * {@link runImage}, plus the optional `COMFY_DEPLOYMENT_VIDEO_PIN` override
 * that pins every video run to a specific deployment regardless of the
 * round-robin rotation (useful when only one deployment has the VRAM budget).
 */
export async function runVideo(
  deploymentEnvKey: string,
  motionPrompt: string,
  sourceImageUrl: string,
): Promise<{ bytes: Buffer; runId: string }> {
  const deploymentId = envPool(deploymentEnvKey);
  if (!deploymentId) {
    if (isFalConfigured()) {
      const bytes = await falGenerateVideo({ prompt: motionPrompt, sourceImageUrl });
      return { bytes, runId: `fal-${Date.now()}` };
    }
    throw new Error(`${deploymentEnvKey} not set (and no FAL_KEY fallback)`);
  }
  // Video is the heaviest workflow (60-180s on a beefier GPU profile).
  // `COMFY_DEPLOYMENT_VIDEO_PIN`, when set, pins every video run to one
  // specific deployment regardless of the round-robin rotation — useful
  // when only one of your N deployments has the larger VRAM budget.
  const override = process.env.COMFY_DEPLOYMENT_VIDEO_PIN?.trim();
  const result = await runWorkflow({
    deploymentId,
    deploymentIdOverride: override || undefined,
    inputs: {
      prompt: motionPrompt,
      source_image: sourceImageUrl,
      duration_seconds: 5,
    },
  });
  if (!result.videos.length) throw new Error('no video returned');
  return { bytes: result.videos[0]!, runId: result.runId };
}

/**
 * Persist a single generated asset to whichever backend is configured.
 * R2 (prod) returns an absolute `https://pub-...r2.dev/...` URL; filesystem
 * (dev fallback) writes under `apps/web/public/generated/{slug}/run-{ts}/`
 * and returns a web-rooted path. Exported for the regenerator which needs
 * the exact same persistence semantics on a per-asset basis.
 */
export async function persistAsset(args: {
  storeSlug: string;
  runDirName: string;
  filename: string;
  bytes: Buffer;
}): Promise<string> {
  const useR2 = isR2Configured();
  if (useR2) {
    return uploadToR2({
      key: `${args.storeSlug}/${args.runDirName}/${args.filename}`,
      body: args.bytes,
      contentType: contentTypeFor(args.filename),
    });
  }
  const storeRoot = path.join(process.cwd(), 'public', 'generated', args.storeSlug);
  const runAbs = path.join(storeRoot, args.runDirName);
  await ensureDir(runAbs);
  await writeAsset(runAbs, args.filename, args.bytes);
  return `/generated/${args.storeSlug}/${args.runDirName}/${args.filename}`;
}

/**
 * Build the run-dir name we use both as the R2 key prefix and the
 * filesystem subdir. Single source of truth so the regenerator and the
 * initial pipeline stay aligned.
 */
import { randomUUID } from 'node:crypto';

export function buildRunDirName(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const unique = randomUUID().slice(0, 8);
  return `run-${ts}-${unique}-flux-kontext`;
}

// Backwards-compatible internal aliases used by generateMonoAssets below.
// The original signatures returned just Buffer; the refactored exported
// helpers return { bytes, runId }. Keep the legacy shape for the existing
// inline calls without a wider refactor.
async function _runImageBuf(deploymentEnvKey: string, prompt: string, refImageUrl: string): Promise<Buffer> {
  return (await runImage(deploymentEnvKey, prompt, refImageUrl)).bytes;
}
async function _runVideoBuf(deploymentEnvKey: string, motionPrompt: string, sourceImageUrl: string): Promise<Buffer> {
  return (await runVideo(deploymentEnvKey, motionPrompt, sourceImageUrl)).bytes;
}

type TracedAssetKind =
  | 'hero'
  | 'cutout'
  | 'lifestyle-1'
  | 'lifestyle-2'
  | 'lifestyle-3'
  | 'promo';

async function tracedAssetStep(args: {
  storeId: string;
  assetKind: TracedAssetKind;
  prompt: string;
  referenceImageUrl: string;
  deploymentEnvKey: string;
  isVideo: boolean;
  persist: (bytes: Buffer) => Promise<string>;
}): Promise<{ url: string | null; error: string | null }> {
  const db = getDb();
  const ins = await db.query<{ id: string }>(
    `INSERT INTO dropship_asset_runs
       (store_id, asset_kind, prompt, reference_image_url, status)
     VALUES ($1, $2, $3, $4, 'running')
     RETURNING id`,
    [args.storeId, args.assetKind, args.prompt, args.referenceImageUrl],
  );
  const runId = ins.rows[0]!.id;

  try {
    const bytes = args.isVideo
      ? await _runVideoBuf(args.deploymentEnvKey, args.prompt, args.referenceImageUrl)
      : await _runImageBuf(args.deploymentEnvKey, args.prompt, args.referenceImageUrl);
    const url = await args.persist(bytes);
    await db.query(
      `UPDATE dropship_asset_runs
          SET status = 'success', result_url = $1, completed_at = now()
        WHERE id = $2`,
      [url, runId],
    );
    return { url, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erreur inconnue';
    console.error(`[asset-generator] ${args.assetKind} failed for store ${args.storeId}: ${message}`);
    await db.query(
      `UPDATE dropship_asset_runs
          SET status = 'error', error_message = $1, completed_at = now()
        WHERE id = $2`,
      [message, runId],
    ).catch(() => {});
    return { url: null, error: message };
  }
}

/**
 * Main entrypoint. Always returns — never throws — so a failed asset run
 * doesn't break store creation. Warnings are surfaced to the caller for the
 * SSE log instead.
 */
export async function generateMonoAssets(
  input: AssetGenInput,
  onProgress?: (msg: string) => void,
): Promise<AssetGenOutput> {
  const warn: string[] = [];
  const errors: string[] = [];
  const log = (m: string) => {
    onProgress?.(m);
  };

  if (!isComfyConfigured() && !isFalConfigured()) {
    warn.push('Aucun backend d\'assets configuré (ni ComfyUI ni FAL_KEY) — assets non générés');
    return {
      runId: '',
      heroUrl: null,
      cutoutUrl: null,
      lifestyleUrls: [],
      promoVideoUrl: null,
      warnings: warn,
      errors: [],
    };
  }
  log(isComfyConfigured() ? 'Backend: ComfyUI Deploy' : 'Backend: fal.ai (fallback)');

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const runDirName = `run-${ts}-flux-kontext`;

  // Decide once which backend we persist to. R2 wins when configured (prod
  // path on Vercel); filesystem is the dev fallback. Logged so the SSE
  // stream surfaces which mode was used for this run.
  const useR2 = isR2Configured();
  log(useR2 ? 'Mode stockage: Cloudflare R2' : 'Mode stockage: filesystem (dev)');

  // Filesystem-only setup. Skipped entirely in R2 mode — Vercel's runtime
  // filesystem outside /tmp is read-only and the mkdir would fail.
  const storeRoot = path.join(process.cwd(), 'public', 'generated', input.storeSlug);
  const runAbs = path.join(storeRoot, runDirName);
  if (!useR2) {
    await ensureDir(runAbs);
  }

  log('Génération des prompts (Claude art director)...');
  const prompts = await buildPromptsWithClaude(input);

  // Web base path used by the storefront in filesystem mode. Web is rooted
  // at /apps/web/public so this resolves to /generated/{slug}/run-{ts}/...
  const webBase = `/generated/${input.storeSlug}/${runDirName}`;
  // R2 key prefix. Convention: `{slug}/run-{ts}/{filename}`. Flat, no leading
  // slash — R2 keys are not paths.
  const r2KeyPrefix = `${input.storeSlug}/${runDirName}`;

  /**
   * Persist a single asset and return the URL we'll store in the DB.
   * R2 → absolute https URL. Filesystem → web-rooted path.
   */
  const persist = async (filename: string, bytes: Buffer): Promise<string> => {
    if (useR2) {
      return uploadToR2({
        key: `${r2KeyPrefix}/${filename}`,
        body: bytes,
        contentType: contentTypeFor(filename),
      });
    }
    await writeAsset(runAbs, filename, bytes);
    return `${webBase}/${filename}`;
  };

  let heroUrl: string | null = null;
  let cutoutUrl: string | null = null;
  const lifestyleUrls: string[] = [];
  let promoVideoUrl: string | null = null;

  // Sequential to keep the GPU queue happy on a single-instance Comfy backend.
  // Concurrency could be added later behind COMFY_PARALLEL.
  log('Génération du hero (1/6)...');
  {
    const r = await tracedAssetStep({
      storeId: input.storeId,
      assetKind: 'hero',
      prompt: prompts.hero,
      referenceImageUrl: input.product.imageUrl,
      deploymentEnvKey: 'COMFY_DEPLOYMENT_HERO',
      isVideo: false,
      persist: (bytes) => persist('hero.png', bytes),
    });
    heroUrl = r.url;
    if (r.error) {
      warn.push(`Hero: ${r.error}`);
      errors.push(`Hero: ${r.error}`);
    }
  }

  log('Génération du cutout (2/6)...');
  {
    const r = await tracedAssetStep({
      storeId: input.storeId,
      assetKind: 'cutout',
      prompt: prompts.cutout,
      referenceImageUrl: input.product.imageUrl,
      deploymentEnvKey: 'COMFY_DEPLOYMENT_CUTOUT',
      isVideo: false,
      persist: (bytes) => persist('cutout.png', bytes),
    });
    cutoutUrl = r.url;
    if (r.error) {
      warn.push(`Cutout: ${r.error}`);
      errors.push(`Cutout: ${r.error}`);
    }
  }

  for (let i = 0; i < prompts.lifestyles.length; i++) {
    log(`Génération lifestyle ${i + 1}/3 (${i + 3}/6)...`);
    const assetKind = `lifestyle-${i + 1}` as 'lifestyle-1' | 'lifestyle-2' | 'lifestyle-3';
    const filename = `lifestyle-${i + 1}.png`;
    const r = await tracedAssetStep({
      storeId: input.storeId,
      assetKind,
      prompt: prompts.lifestyles[i]!,
      referenceImageUrl: input.product.imageUrl,
      deploymentEnvKey: 'COMFY_DEPLOYMENT_LIFESTYLE',
      isVideo: false,
      persist: (bytes) => persist(filename, bytes),
    });
    if (r.url) lifestyleUrls.push(r.url);
    if (r.error) {
      warn.push(`Lifestyle ${i + 1}: ${r.error}`);
      errors.push(`Lifestyle ${i + 1}: ${r.error}`);
    }
  }

  if (!input.skipVideo && process.env.COMFY_DEPLOYMENT_VIDEO) {
    log('Génération de la vidéo promo 5s (6/6)...');
    // Drive the video off the cutout if we got one (cleanest framing) else
    // the supplier ref. In R2 mode `cutoutUrl` is already absolute; in
    // filesystem mode we prepend the public base so ComfyUI can fetch it.
    const videoSource = cutoutUrl
      ? (useR2 ? cutoutUrl : `${process.env.NEXT_PUBLIC_BASE_URL || ''}${cutoutUrl}`)
      : input.product.imageUrl;
    const r = await tracedAssetStep({
      storeId: input.storeId,
      assetKind: 'promo',
      prompt: prompts.promo,
      referenceImageUrl: videoSource,
      deploymentEnvKey: 'COMFY_DEPLOYMENT_VIDEO',
      isVideo: true,
      persist: (bytes) => persist('promo.mp4', bytes),
    });
    promoVideoUrl = r.url;
    if (r.error) {
      warn.push(`Vidéo: ${r.error}`);
      errors.push(`Vidéo: ${r.error}`);
    }
  }

  // Re-point /current → latest run so the storefront's existsSync checks find
  // it. Filesystem mode only — in R2 mode the DB stores the absolute URL of
  // the latest run directly, so there is no "current" indirection to maintain.
  if (!useR2) {
    try {
      await repointCurrent(storeRoot, runDirName);
    } catch (e) {
      warn.push(`current symlink: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }

  return {
    runId: runDirName,
    heroUrl,
    cutoutUrl,
    lifestyleUrls,
    promoVideoUrl,
    warnings: warn,
    errors,
  };
}

/*
 * Production storage:
 *
 * R2 is now wired (see imports above). When the five R2_* env vars are set,
 * generated assets land in Cloudflare R2 under `{slug}/run-{ts}/...` and the
 * absolute public URL (`https://pub-...r2.dev/...`) is stored in
 * `dropship_stores.hero_image_url` / `cutout_image_url` / `lifestyle_images`
 * / `promo_video_url`. Survives redeploys. No /public writes.
 *
 * The filesystem path is preserved as a dev fallback so this module still
 * works locally without R2 credentials.
 */
