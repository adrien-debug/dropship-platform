import { promises as fs } from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { runWorkflow, isComfyConfigured } from './comfy-client';
import { extractJson } from './json';
import { isR2Configured, uploadToR2 } from '@/lib/storage/r2';

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
 *     hero.png           (1920×1080, cinematic editorial — full-bleed)
 *     cutout.png         (1600×1000, product on dark stage — for ProductShowcase)
 *     lifestyle-1.png    (1600×1000, in-context shot)
 *     lifestyle-2.png    (1600×1000, alt context)
 *     lifestyle-3.png    (1600×1000, alt context)
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
  storeSlug: string;
  /** The product the agent already picked (highest-quality supplier image). */
  product: { title: string; description: string; imageUrl: string };
  /** Tone words: "cinematic", "minimal", "editorial". Drives prompt phrasing. */
  niche: string;
  /** "fr" | "en" — only affects prompt language for Claude. Generation is en-only. */
  language?: 'fr' | 'en';
  /** Skip video generation (faster, cheaper). Default false. */
  skipVideo?: boolean;
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
}

interface PromptBundle {
  hero: string;
  cutout: string;
  lifestyles: string[]; // 3 entries
  promo: string; // image-to-video motion description
}

const FALLBACK_PROMPTS: PromptBundle = {
  hero: 'Cinematic editorial product photograph, full-bleed wide composition, soft directional light, premium DTC brand aesthetic, ultra detailed, 35mm, depth of field',
  cutout: 'Single product centered on dark gradient studio backdrop, soft rim light, premium e-commerce hero shot, ultra clean, no text, no labels',
  lifestyles: [
    'Product in a sunlit modern living room, lifestyle context, natural daylight, premium editorial photograph',
    'Product on a minimalist café table, morning light, shallow depth of field, magazine quality',
    'Product outdoors on a wooden terrace, golden hour, premium lifestyle product photograph',
  ],
  promo: 'Slow gentle parallax push-in, subtle ambient motion, cinematic 5 second loop, no text',
};

async function buildPromptsWithClaude(input: AssetGenInput): Promise<PromptBundle> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK_PROMPTS;

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an art director writing prompts for a FLUX Kontext image generator. We will use the same product reference image for all prompts (passed separately as image input).

Product: "${input.product.title}"
Niche: "${input.niche}"
Description excerpt: "${input.product.description.slice(0, 300)}"

Write FLUX prompts for a premium DTC landing page (think Apple, Dyson, Bose). Critical rules:
- ENGLISH ONLY for prompts (FLUX is anglophone).
- NO text, badges, labels, prices, watermarks, or signage in the scene. Never write the word "text".
- The product itself stays photorealistic and IDENTICAL to the reference (FLUX Kontext preserves it).
- Vary backgrounds and contexts wildly between lifestyles.

Return ONLY this JSON:
{
  "hero": "<one prompt for a full-bleed cinematic hero, 16:9, editorial mood, the product subtly featured>",
  "cutout": "<one prompt for the product centered on a dark studio gradient, no other objects, no text>",
  "lifestyles": [
    "<context A — indoor moment>",
    "<context B — outdoor moment>",
    "<context C — situational use moment>"
  ],
  "promo": "<motion description for a 5-second image-to-video promo: slow camera move, ambient light shift, no cuts>"
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

async function runImage(deploymentEnvKey: string, prompt: string, refImageUrl: string) {
  const deploymentId = process.env[deploymentEnvKey];
  if (!deploymentId) throw new Error(`${deploymentEnvKey} not set`);
  const result = await runWorkflow({
    deploymentId,
    inputs: {
      prompt,
      reference_image: refImageUrl,
      negative_prompt: 'text, watermark, logo, label, badge, price, discount, sale, signage, lettering, typography',
    },
  });
  if (!result.images.length) throw new Error('no image returned');
  return result.images[0]!;
}

async function runVideo(deploymentEnvKey: string, motionPrompt: string, sourceImageUrl: string) {
  const deploymentId = process.env[deploymentEnvKey];
  if (!deploymentId) throw new Error(`${deploymentEnvKey} not set`);
  const result = await runWorkflow({
    deploymentId,
    inputs: {
      prompt: motionPrompt,
      source_image: sourceImageUrl,
      duration_seconds: 5,
    },
  });
  if (!result.videos.length) throw new Error('no video returned');
  return result.videos[0]!;
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
  const log = (m: string) => {
    onProgress?.(m);
  };

  if (!isComfyConfigured()) {
    warn.push('ComfyUI non configuré (COMFY_DEPLOY_API_KEY / COMFYUI_URL absent) — assets non générés');
    return {
      runId: '',
      heroUrl: null,
      cutoutUrl: null,
      lifestyleUrls: [],
      promoVideoUrl: null,
      warnings: warn,
    };
  }

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
  try {
    log('Génération du hero (1/6)...');
    const heroBytes = await runImage('COMFY_DEPLOYMENT_HERO', prompts.hero, input.product.imageUrl);
    heroUrl = await persist('hero.png', heroBytes);
  } catch (e) {
    warn.push(`Hero: ${e instanceof Error ? e.message : 'erreur'}`);
  }

  try {
    log('Génération du cutout (2/6)...');
    const cutoutBytes = await runImage('COMFY_DEPLOYMENT_CUTOUT', prompts.cutout, input.product.imageUrl);
    cutoutUrl = await persist('cutout.png', cutoutBytes);
  } catch (e) {
    warn.push(`Cutout: ${e instanceof Error ? e.message : 'erreur'}`);
  }

  for (let i = 0; i < prompts.lifestyles.length; i++) {
    try {
      log(`Génération lifestyle ${i + 1}/3 (${i + 3}/6)...`);
      const bytes = await runImage(
        'COMFY_DEPLOYMENT_LIFESTYLE',
        prompts.lifestyles[i]!,
        input.product.imageUrl,
      );
      const filename = `lifestyle-${i + 1}.png`;
      const url = await persist(filename, bytes);
      lifestyleUrls.push(url);
    } catch (e) {
      warn.push(`Lifestyle ${i + 1}: ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }

  if (!input.skipVideo && process.env.COMFY_DEPLOYMENT_VIDEO) {
    try {
      log('Génération de la vidéo promo 5s (6/6)...');
      // Drive the video off the cutout if we got one (cleanest framing) else
      // the supplier ref. In R2 mode `cutoutUrl` is already absolute; in
      // filesystem mode we prepend the public base so ComfyUI can fetch it.
      const videoSource = cutoutUrl
        ? (useR2 ? cutoutUrl : `${process.env.NEXT_PUBLIC_BASE_URL || ''}${cutoutUrl}`)
        : input.product.imageUrl;
      const videoBytes = await runVideo('COMFY_DEPLOYMENT_VIDEO', prompts.promo, videoSource);
      promoVideoUrl = await persist('promo.mp4', videoBytes);
    } catch (e) {
      warn.push(`Vidéo: ${e instanceof Error ? e.message : 'erreur'}`);
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
