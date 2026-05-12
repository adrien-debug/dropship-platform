/**
 * Per-asset regeneration pipeline.
 *
 * Where {@link generateMonoAssets} runs the full hero/cutout/lifestyle/promo
 * bundle once at store creation, this module regenerates ONE asset on demand
 * and records the run in `dropship_asset_runs`. It is the engine behind the
 * `/admin/stores/[id]/assets` UI:
 *
 *   - Load store + first product (the reference image FLUX Kontext anchors on)
 *   - Either accept a `customPrompt` from the admin verbatim, or derive a
 *     fresh single-asset prompt via Claude using the same art-direction
 *     rules as the initial pipeline.
 *   - Run the matching ComfyUI workflow (hero / cutout / lifestyle / video).
 *   - Persist the result via the shared {@link persistAsset} helper, which
 *     picks R2 (prod) or filesystem (dev) automatically.
 *   - Insert a row in `dropship_asset_runs`, demote the previous current row
 *     for that (store, asset_kind), and update the matching column on
 *     `dropship_stores` so the storefront immediately reflects the new asset.
 *
 * Failure model: errors are caught, written to the row as `status='error'`
 * with the message, and re-thrown for the SSE caller to surface. The
 * `dropship_stores` row is NEVER touched on failure — the previous asset
 * stays live. This is the entire point of having a regeneration log: bad
 * runs cost a Comfy credit but never break the storefront.
 */

import { getDb } from '@/lib/db';
import { isComfyConfigured } from './comfy-client';
import { isFalConfigured } from './fal-client';
import {
  buildRunDirName,
  FALLBACK_PROMPTS,
  persistAsset,
  runImage,
  runVideo,
} from './asset-generator';
import { extractJson } from './json';
import { trackedMessage } from './anthropic';

export type AssetKind = 'hero' | 'cutout' | 'lifestyle-1' | 'lifestyle-2' | 'lifestyle-3' | 'promo';

export const ASSET_KINDS: readonly AssetKind[] = [
  'hero',
  'cutout',
  'lifestyle-1',
  'lifestyle-2',
  'lifestyle-3',
  'promo',
] as const;

export interface RegenerateInput {
  storeId: string;
  kind: AssetKind;
  /** When provided, used verbatim as the FLUX prompt — no Claude call. */
  customPrompt?: string;
  /** Override the reference image. Defaults to the store's first product image. */
  productImageUrl?: string;
}

export interface RegenerateResult {
  runId: string;
  url: string;
  warnings: string[];
}

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  lifestyle_images: unknown;
}

interface ProductRow {
  enriched_title: string | null;
  enriched_description: string | null;
  image_url: string | null;
}

/** Filename written under the run-dir for each asset kind. */
function filenameFor(kind: AssetKind): string {
  if (kind === 'hero') return 'hero.png';
  if (kind === 'cutout') return 'cutout.png';
  if (kind === 'promo') return 'promo.mp4';
  // lifestyle-1 → lifestyle-1.png, etc.
  return `${kind}.png`;
}

/** ComfyUI deployment env key resolved per asset kind. */
function deploymentEnvKeyFor(kind: AssetKind): string {
  if (kind === 'hero') return 'COMFY_DEPLOYMENT_HERO';
  if (kind === 'cutout') return 'COMFY_DEPLOYMENT_CUTOUT';
  if (kind === 'promo') return 'COMFY_DEPLOYMENT_VIDEO';
  return 'COMFY_DEPLOYMENT_LIFESTYLE';
}

/** Fallback (no Claude) single-asset prompt for each kind. */
function fallbackPromptFor(kind: AssetKind): string {
  if (kind === 'hero') return FALLBACK_PROMPTS.hero;
  if (kind === 'cutout') return FALLBACK_PROMPTS.cutout;
  if (kind === 'promo') return FALLBACK_PROMPTS.promo;
  const idx = kind === 'lifestyle-1' ? 0 : kind === 'lifestyle-2' ? 1 : 2;
  return FALLBACK_PROMPTS.lifestyles[idx]!;
}

/**
 * Lookup the store + its highest-quality product image. Throws when the store
 * is missing or has no usable reference image — both are unrecoverable for the
 * regeneration path (FLUX Kontext requires a reference).
 */
async function loadStoreAndProduct(storeId: string): Promise<{
  store: StoreRow;
  product: ProductRow;
}> {
  const db = getDb();
  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, lifestyle_images
       FROM dropship_stores
      WHERE id = $1
      LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) throw new Error(`Store ${storeId} introuvable`);

  const productRes = await db.query<ProductRow>(
    `SELECT enriched_title, enriched_description, image_url
       FROM dropship_store_products
      WHERE store_id = $1 AND image_url IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1`,
    [storeId],
  );
  const product = productRes.rows[0];
  if (!product || !product.image_url) {
    throw new Error(`Aucun produit avec image de référence pour le store ${storeId}`);
  }
  return { store, product };
}

/**
 * Claude single-asset prompt builder. Mirrors the rules in the initial
 * `buildPromptsWithClaude` (no text, no labels, English-only, the product
 * stays photorealistic) but for a single slot. Falls back to a canned prompt
 * on any error so the user can always hit "Lancer" and get *something*.
 */
async function buildSingleAssetPromptWithClaude(args: {
  storeId: string;
  kind: AssetKind;
  niche: string;
  product: ProductRow;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackPromptFor(args.kind);

  const slotDescription = (() => {
    if (args.kind === 'hero') {
      return 'one prompt for a full-bleed cinematic hero, 16:9, editorial mood, the product subtly featured';
    }
    if (args.kind === 'cutout') {
      return 'one prompt for the product centered on a dark studio gradient, no other objects, no text';
    }
    if (args.kind === 'lifestyle-1') {
      return 'one prompt for a context A lifestyle — indoor moment, sunlit modern interior, magazine quality';
    }
    if (args.kind === 'lifestyle-2') {
      return 'one prompt for a context B lifestyle — outdoor moment, natural daylight, premium editorial';
    }
    if (args.kind === 'lifestyle-3') {
      return 'one prompt for a context C lifestyle — situational use moment, distinct environment from A and B';
    }
    return 'a motion description for a 5-second image-to-video promo: slow camera move, ambient light shift, no cuts';
  })();

  try {
    const res = await trackedMessage(
      { storeId: args.storeId, step: `asset-regen-prompt:${args.kind}` },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are an art director writing a FLUX Kontext prompt. The product reference image will be passed separately (FLUX preserves the product identity).

Product: "${args.product.enriched_title ?? ''}"
Niche: "${args.niche}"
Description excerpt: "${(args.product.enriched_description ?? '').slice(0, 300)}"

Slot to fill: ${slotDescription}

Rules:
- ENGLISH ONLY.
- NO text, badges, labels, prices, watermarks, signage in the scene. Never write the word "text".
- The product itself stays photorealistic and IDENTICAL to the reference.
- Premium DTC brand aesthetic (think Apple, Dyson, Bose).

Return ONLY this JSON: { "prompt": "<your prompt>" }`,
          },
        ],
      },
    );
    const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    const parsed = extractJson<{ prompt?: string }>(text);
    if (parsed?.prompt && typeof parsed.prompt === 'string') return parsed.prompt;
    return fallbackPromptFor(args.kind);
  } catch {
    return fallbackPromptFor(args.kind);
  }
}

/**
 * Update the matching column on `dropship_stores` so the storefront picks up
 * the new asset on the next render. Lifestyle slots replace one entry of the
 * JSONB array; hero/cutout/promo are single columns.
 */
async function applyAssetToStore(args: {
  storeId: string;
  kind: AssetKind;
  url: string;
}): Promise<void> {
  const db = getDb();
  if (args.kind === 'hero') {
    await db.query(
      `UPDATE dropship_stores
          SET hero_image_url = $1,
              assets_status = 'ready',
              updated_at = now()
        WHERE id = $2`,
      [args.url, args.storeId],
    );
    return;
  }
  if (args.kind === 'cutout') {
    await db.query(
      `UPDATE dropship_stores
          SET cutout_image_url = $1,
              assets_status = 'ready',
              updated_at = now()
        WHERE id = $2`,
      [args.url, args.storeId],
    );
    return;
  }
  if (args.kind === 'promo') {
    await db.query(
      `UPDATE dropship_stores
          SET promo_video_url = $1,
              assets_status = 'ready',
              updated_at = now()
        WHERE id = $2`,
      [args.url, args.storeId],
    );
    return;
  }
  // Lifestyle slot — replace the right index of the lifestyle_images array.
  const slotIdx = args.kind === 'lifestyle-1' ? 0 : args.kind === 'lifestyle-2' ? 1 : 2;
  const current = await db.query<{ lifestyle_images: unknown }>(
    `SELECT lifestyle_images FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [args.storeId],
  );
  const existing = Array.isArray(current.rows[0]?.lifestyle_images)
    ? (current.rows[0]!.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  const next = [...existing];
  while (next.length < slotIdx) next.push('');
  next[slotIdx] = args.url;
  await db.query(
    `UPDATE dropship_stores
        SET lifestyle_images = $1::jsonb,
            assets_status = 'ready',
            updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(next), args.storeId],
  );
}

/**
 * Demote the previous `is_current` run for (store, kind) and promote `runId`.
 * Used by both the regenerate-success path and the "set as current" rollback
 * endpoint. Wraps the two UPDATEs in a single client transaction so a partial
 * failure can't leave the table with zero or two `is_current` rows.
 */
export async function promoteRunAsCurrent(args: {
  storeId: string;
  kind: AssetKind;
  runId: string;
}): Promise<void> {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE dropship_asset_runs
          SET is_current = false
        WHERE store_id = $1 AND asset_kind = $2 AND is_current = true`,
      [args.storeId, args.kind],
    );
    await client.query(
      `UPDATE dropship_asset_runs
          SET is_current = true
        WHERE id = $1`,
      [args.runId],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Entry point. Always returns the final URL (R2 or filesystem) and the
 * `dropship_asset_runs.id` of the row that now backs the store. Throws on
 * configuration or pipeline failures — the row is still written with
 * `status='error'` so the history strip surfaces the failed attempt.
 */
export async function regenerateAsset(
  input: RegenerateInput,
  onProgress?: (msg: string) => void,
): Promise<RegenerateResult> {
  const warnings: string[] = [];
  const log = (m: string) => onProgress?.(m);

  if (!isComfyConfigured() && !isFalConfigured()) {
    throw new Error(
      'Aucun backend d\'assets configuré (ni ComfyUI ni FAL_KEY) — régénération impossible.',
    );
  }
  log(isComfyConfigured() ? 'Backend: ComfyUI Deploy' : 'Backend: fal.ai (fallback)');

  log('Chargement du store et du produit de référence...');
  const { store, product } = await loadStoreAndProduct(input.storeId);
  const refImageUrl = input.productImageUrl ?? product.image_url!;

  log(input.customPrompt ? 'Utilisation du prompt personnalisé.' : 'Génération du prompt (Claude)...');
  const prompt =
    input.customPrompt && input.customPrompt.trim().length > 0
      ? input.customPrompt.trim()
      : await buildSingleAssetPromptWithClaude({
          storeId: input.storeId,
          kind: input.kind,
          niche: store.niche,
          product,
        });

  // Insert the row up-front as 'running' so the history strip surfaces an
  // in-flight run even if the Lambda dies mid-generation.
  const db = getDb();
  const insertRes = await db.query<{ id: string }>(
    `INSERT INTO dropship_asset_runs
       (store_id, asset_kind, prompt, reference_image_url, status)
     VALUES ($1, $2, $3, $4, 'running')
     RETURNING id`,
    [input.storeId, input.kind, prompt, refImageUrl],
  );
  const runId = insertRes.rows[0]!.id;

  try {
    log(`Lancement du workflow ComfyUI (${input.kind})...`);
    const filename = filenameFor(input.kind);
    const deploymentEnvKey = deploymentEnvKeyFor(input.kind);
    const runDir = buildRunDirName();

    let result: { bytes: Buffer; runId: string };
    if (input.kind === 'promo') {
      result = await runVideo(deploymentEnvKey, prompt, refImageUrl);
    } else {
      result = await runImage(deploymentEnvKey, prompt, refImageUrl);
    }

    log('Persistance du résultat...');
    const url = await persistAsset({
      storeSlug: store.slug,
      runDirName: runDir,
      filename,
      bytes: result.bytes,
    });

    // Mark this run as success, demote the previous current, promote this one,
    // and update the store column. Order matters: row must be 'success' before
    // we flip is_current so a reader doesn't see a current row that's still
    // 'running'.
    await db.query(
      `UPDATE dropship_asset_runs
          SET status = 'success',
              result_url = $1,
              comfy_run_id = $2,
              completed_at = now()
        WHERE id = $3`,
      [url, result.runId || null, runId],
    );
    await promoteRunAsCurrent({ storeId: input.storeId, kind: input.kind, runId });
    await applyAssetToStore({ storeId: input.storeId, kind: input.kind, url });

    log('Terminé.');
    return { runId, url, warnings };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erreur inconnue';
    await db
      .query(
        `UPDATE dropship_asset_runs
            SET status = 'error',
                error_message = $1,
                completed_at = now()
          WHERE id = $2`,
        [message, runId],
      )
      .catch(() => {});
    throw e;
  }
}

/**
 * Load up to `limit` runs per asset_kind for the given store, ordered by
 * newest first. Used by the admin history strip and the "set as current"
 * action.
 */
export async function listRunsForStore(storeId: string, limit = 10) {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    asset_kind: AssetKind | 'all';
    prompt: string | null;
    reference_image_url: string | null;
    result_url: string | null;
    status: 'pending' | 'running' | 'success' | 'error';
    error_message: string | null;
    is_current: boolean;
    created_at: string;
    completed_at: string | null;
  }>(
    `SELECT id, asset_kind, prompt, reference_image_url, result_url, status,
            error_message, is_current, created_at, completed_at
       FROM dropship_asset_runs
      WHERE store_id = $1
      ORDER BY asset_kind ASC, created_at DESC`,
    [storeId],
  );
  // Group by asset_kind, keep newest `limit` per slot.
  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    const k = r.asset_kind;
    if (!grouped[k]) grouped[k] = [];
    if (grouped[k]!.length < limit) grouped[k]!.push(r);
  }
  return grouped;
}

/**
 * "Set as current" a previous run: flips `is_current` to that run and writes
 * the old URL back into the matching column on `dropship_stores`. The asset
 * file itself isn't touched — we're just re-pointing the storefront at an
 * earlier render.
 */
export async function setRunAsCurrent(args: {
  storeId: string;
  runId: string;
  kind: AssetKind;
}): Promise<{ url: string }> {
  const db = getDb();
  const { rows } = await db.query<{
    store_id: string;
    asset_kind: AssetKind | 'all';
    result_url: string | null;
    status: string;
  }>(
    `SELECT store_id, asset_kind, result_url, status
       FROM dropship_asset_runs
      WHERE id = $1
      LIMIT 1`,
    [args.runId],
  );
  const run = rows[0];
  if (!run) throw new Error('Run introuvable');
  if (run.store_id !== args.storeId) throw new Error('Run ne correspond pas au store');
  if (run.asset_kind !== args.kind) throw new Error('Run d’un autre type d’asset');
  if (run.status !== 'success' || !run.result_url) {
    throw new Error('Run sans résultat — impossible de le définir comme courant');
  }

  await promoteRunAsCurrent({ storeId: args.storeId, kind: args.kind, runId: args.runId });
  await applyAssetToStore({ storeId: args.storeId, kind: args.kind, url: run.result_url });
  return { url: run.result_url };
}
