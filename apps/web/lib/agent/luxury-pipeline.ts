/**
 * Luxury pipeline — turn a commodity dropshipping store into a $300-perceived-value
 * maison overnight.
 *
 * Given a store id, this:
 *   1. Loads the store + its first product.
 *   2. Re-renders the visual assets through fal.ai using the prompts in
 *      `luxury-prompts.ts` (editorial framing, studio lighting, neutral
 *      backdrops, packaging shot).
 *   3. Generates literary French copy via Claude (luxury brand voice).
 *   4. Persists everything to R2 / public.
 *   5. Updates `dropship_stores` (template = 'luxury-mono', new hero/cutout
 *      URLs, lifestyle gallery, landingContent.luxury_copy).
 *
 * Designed to be idempotent: each run creates a fresh `run-*-luxury` dir so
 * we can A/B compare. The previous URLs stay reachable in R2 if you need to
 * roll back manually.
 *
 * Costs (fal.ai rough estimates, as of May 2026):
 *   - hero (ultra + clarity 2×): ~$0.07
 *   - cutout + 3 lifestyles + packaging: 5 × ~$0.025 = ~$0.13
 *   - video (kling-v2 image-to-video 5s): ~$0.30
 *   - Claude opus copy: ~$0.05
 *   Total per upgrade: ~$0.55. Cheap relative to the perceived-value lift.
 */

import { getDb } from '@/lib/db';
import { listProducts } from '@/lib/medusa-store';
import { getStoreBySlug } from '@/lib/store-config';
import { trackedMessage } from './anthropic';
import { runContext } from './run-context';
import { isFalConfigured } from './fal-client';
import { runImage, runVideo, persistAsset, buildRunDirName } from './asset-generator';
import { extractJson } from './json';
import {
  luxuryHeroPrompt,
  luxuryCutoutPrompt,
  luxuryLifestylePrompts,
  luxuryPackagingPrompt,
  luxuryVideoPrompt,
  luxuryCopySystemPrompt,
  luxuryCopyUserPrompt,
  type LuxuryBrandContext,
  type LuxuryCopyOutput,
} from './luxury-prompts';

const LUX_RUN_PREFIX = (): string => buildRunDirName().replace('-flux-kontext', '-luxury');

export interface LuxuryUpgradeResult {
  storeId: string;
  storeSlug: string;
  runDir: string;
  heroUrl: string;
  cutoutUrl: string;
  lifestyleUrls: string[];
  packagingUrl: string;
  videoUrl: string | null;
  copy: LuxuryCopyOutput;
  /** Suggested price in euros (15-20x the supplier cost). Caller persists
   *  this on the variant when applicable; we surface it but don't write
   *  the Medusa variant ourselves to keep the pipeline focused. */
  suggestedPriceEuros: number | null;
  /** Non-null when image generation failed (e.g. fal balance exhausted).
   *  Copy + template flip still persisted; the store keeps its old assets. */
  imagesError: string | null;
}

export async function runLuxuryUpgrade(storeId: string): Promise<LuxuryUpgradeResult> {
  const log = (msg: string) => console.log(`[luxury-upgrade ${storeId}] ${msg}`);
  log('start');
  // Image/video backend is resolved per-call by runImage/runVideo:
  // 1. COMFY_DEPLOYMENT_* + COMFY_DEPLOY_API_KEY → user's own GPUs (preferred)
  // 2. FAL_KEY → fal.ai fallback
  // 3. neither → throw. We pre-check just one for a friendlier error.
  if (!isFalConfigured() && !process.env.COMFY_DEPLOY_API_KEY) {
    throw new Error(
      'No image backend configured. Set COMFY_DEPLOYMENT_* (preferred) or FAL_KEY in .env.local.',
    );
  }
  log('backend configured');
  const db = getDb();
  const { rows } = await db.query<{
    slug: string;
    name: string;
    niche: string;
    accent_color: string;
    primary_color: string;
    description: string | null;
    tagline: string | null;
  }>(
    `SELECT slug, name, niche, accent_color, primary_color, description, tagline
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const row = rows[0];
  if (!row) throw new Error(`store ${storeId} not found`);

  const store = await getStoreBySlug(row.slug);
  if (!store) throw new Error(`store ${row.slug} hydration failed`);
  log(`store hydrated: ${store.slug}`);

  let products;
  try {
    const res = await listProducts({
      publishableKey: store.medusaPublishableKey,
      limit: 1,
    });
    products = res.products;
  } catch (err) {
    throw new Error(`listProducts failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  log(`products fetched: ${products.length}`);
  const product = products[0];
  if (!product) {
    throw new Error(
      `store ${row.slug} has no products — luxury upgrade requires at least 1 SKU`,
    );
  }

  const refImage =
    product.thumbnail || product.images?.[0]?.url || store.heroImageUrl || undefined;
  const supplierDescription = product.description ?? row.description ?? '';
  const supplierCostCents = product.variants?.[0]?.calculated_price?.calculated_amount;
  const suggestedPriceEuros = supplierCostCents
    ? Math.round((supplierCostCents / 100) * 17)
    : null;

  const ctx: LuxuryBrandContext = {
    storeName: row.name,
    productName: product.title,
    niche: row.niche,
    accentColor: row.accent_color || row.primary_color || '#7a5c3a',
    positioning: row.tagline ?? undefined,
    referenceImageUrl: refImage,
  };

  const runDir = LUX_RUN_PREFIX();
  log(`runDir=${runDir}, fanning out 6 images + copy…`);

  // ── Fan out the 6 image renders + Claude copy in parallel ────────────
  // runImage routes to ComfyUI when COMFY_DEPLOYMENT_<KIND> is set, falls
  // back to fal.ai when only FAL_KEY is configured. The KIND tag (HERO /
  // CUTOUT / LIFESTYLE) controls which deployment pool gets picked.
  const [lifestyle1Prompt, lifestyle2Prompt, lifestyle3Prompt] = luxuryLifestylePrompts(ctx);
  const refImageForRunImage = refImage ?? '';
  const imagesPromise = Promise.all([
    runImage('COMFY_DEPLOYMENT_HERO', luxuryHeroPrompt(ctx), refImageForRunImage).then((r) => r.bytes),
    runImage('COMFY_DEPLOYMENT_CUTOUT', luxuryCutoutPrompt(ctx), refImageForRunImage).then((r) => r.bytes),
    runImage('COMFY_DEPLOYMENT_LIFESTYLE', lifestyle1Prompt!, refImageForRunImage).then((r) => r.bytes),
    runImage('COMFY_DEPLOYMENT_LIFESTYLE', lifestyle2Prompt!, refImageForRunImage).then((r) => r.bytes),
    runImage('COMFY_DEPLOYMENT_LIFESTYLE', lifestyle3Prompt!, refImageForRunImage).then((r) => r.bytes),
    runImage('COMFY_DEPLOYMENT_LIFESTYLE', luxuryPackagingPrompt(ctx), refImageForRunImage).then((r) => r.bytes),
  ]);
  const copyPromise = generateLuxuryCopy(ctx, supplierDescription, suggestedPriceEuros);
  // Copy must succeed (Claude credit is independent of fal credit). Images
  // are best-effort: if the fal account is locked / out of balance / blocked
  // by safety, we still flip the template and update the copy so the operator
  // gets value out of the run.
  let copy: LuxuryCopyOutput;
  try {
    copy = await copyPromise;
  } catch (err) {
    throw new Error(`copy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  log(`copy ok`);

  let heroBytes: Buffer | null = null;
  let cutoutBytes: Buffer | null = null;
  let ls1Bytes: Buffer | null = null;
  let ls2Bytes: Buffer | null = null;
  let ls3Bytes: Buffer | null = null;
  let pkgBytes: Buffer | null = null;
  let imagesError: string | null = null;
  try {
    [heroBytes, cutoutBytes, ls1Bytes, ls2Bytes, ls3Bytes, pkgBytes] = await imagesPromise;
    log(`images ok (6 buffers)`);
  } catch (err) {
    imagesError = err instanceof Error ? err.message : String(err);
    log(`images skipped (${imagesError})`);
  }

  // ── Persist images so the video step has hosted URLs to anchor on ────
  const persistIfPresent = async (filename: string, bytes: Buffer | null) =>
    bytes
      ? persistAsset({ storeSlug: row.slug, runDirName: runDir, filename, bytes })
      : null;

  const [heroUrl, cutoutUrl, ls1Url, ls2Url, ls3Url, packagingUrl] = await Promise.all([
    persistIfPresent('hero.png', heroBytes),
    persistIfPresent('cutout.png', cutoutBytes),
    persistIfPresent('lifestyle-1.png', ls1Bytes),
    persistIfPresent('lifestyle-2.png', ls2Bytes),
    persistIfPresent('lifestyle-3.png', ls3Bytes),
    persistIfPresent('packaging.png', pkgBytes),
  ]);
  log(`persisted ${[heroUrl, cutoutUrl, ls1Url, ls2Url, ls3Url, packagingUrl].filter(Boolean).length}/6 assets`);

  // ── Video (best-effort — non-blocking; some niches return safety-blocked) ─
  let videoUrl: string | null = null;
  if (cutoutUrl) {
    try {
      const { bytes: videoBytes } = await runVideo(
        'COMFY_DEPLOYMENT_VIDEO',
        luxuryVideoPrompt(ctx),
        cutoutUrl,
      );
      videoUrl = await persistAsset({
        storeSlug: row.slug,
        runDirName: runDir,
        filename: 'promo.mp4',
        bytes: videoBytes,
      });
      log(`video persisted`);
    } catch (err) {
      console.warn(`luxury video skipped for ${row.slug}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── DB update: template flip + asset URLs + landing copy ─────────────
  const landingPatch = {
    luxury_copy: copy,
    // Preserve existing landingContent fields the storefront might read.
    selling_points: copy.atelier_pillars.map((p) => ({ title: p.title, body: p.body })),
  };

  // COALESCE the new URLs with existing so a partial run (e.g. fal locked)
  // keeps whatever was there before.
  await db.query(
    `UPDATE dropship_stores
        SET template = 'luxury-mono',
            hero_image_url = COALESCE($1, hero_image_url),
            cutout_image_url = COALESCE($2, cutout_image_url),
            lifestyle_images = CASE
              WHEN $3::jsonb = '[null,null,null,null]'::jsonb THEN lifestyle_images
              ELSE $3::jsonb
            END,
            promo_video_url = COALESCE($4, promo_video_url),
            landing_content = COALESCE(landing_content, '{}'::jsonb) || $5::jsonb,
            updated_at = NOW()
      WHERE id = $6`,
    [
      heroUrl,
      cutoutUrl,
      JSON.stringify([ls1Url, ls2Url, ls3Url, packagingUrl]),
      videoUrl,
      JSON.stringify(landingPatch),
      storeId,
    ],
  );
  log(`db updated, template=luxury-mono`);

  return {
    storeId,
    storeSlug: row.slug,
    runDir,
    heroUrl: heroUrl ?? '',
    cutoutUrl: cutoutUrl ?? '',
    lifestyleUrls: [ls1Url, ls2Url, ls3Url].filter((u): u is string => Boolean(u)),
    packagingUrl: packagingUrl ?? '',
    videoUrl,
    copy,
    suggestedPriceEuros,
    imagesError,
  };
}

async function generateLuxuryCopy(
  ctx: LuxuryBrandContext,
  supplierDescription: string,
  priceEuros: number | null,
): Promise<LuxuryCopyOutput> {
  return runContext.run({ storeId: null }, async () => {
    const response = await trackedMessage(
      { storeId: null, step: 'luxury-copy' },
      {
        model: 'claude-opus-4-7',
        max_tokens: 1500,
        system: luxuryCopySystemPrompt(),
        messages: [
          {
            role: 'user',
            content: luxuryCopyUserPrompt({
              ...ctx,
              supplierDescription,
              priceEuros: priceEuros ?? undefined,
            }),
          },
        ],
      },
    );
    const textBlock = response.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text block for luxury copy');
    }
    const parsed = extractJson<LuxuryCopyOutput>(textBlock.text);
    if (!parsed) throw new Error('Claude returned non-JSON luxury copy');
    return parsed;
  });
}
