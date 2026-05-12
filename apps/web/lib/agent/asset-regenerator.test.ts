/**
 * Unit coverage for the P1.6 per-asset regeneration pipeline.
 *
 * Scope: stub `getDb`, the ComfyUI helpers (runImage/runVideo), the persist
 * step (persistAsset), and `trackedMessage` so the test exercises only the
 * orchestration: prompt building, history row lifecycle, is_current
 * promotion, and `dropship_stores` column rewrites.
 *
 * We do NOT hit the real comfy-client / r2 paths — those have their own
 * dedicated tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

// Per-pattern row provider; same shape as anomaly-watch.test.ts. Matching is
// substring-based, but we order patterns first-wins for the few overlapping
// UPDATEs.
type RowSet = unknown[];
const rowsByPattern: { pattern: string; rows: RowSet }[] = [];
const captured: CapturedQuery[] = [];

function setRows(pattern: string, rows: RowSet) {
  rowsByPattern.push({ pattern, rows });
}

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });
  for (const { pattern, rows } of rowsByPattern) {
    if (sql.includes(pattern)) {
      return Promise.resolve({ rows: rows as T[], rowCount: rows.length });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

// Pooled client shape for the BEGIN/UPDATE/COMMIT transaction used by
// promoteRunAsCurrent.
function makeClient() {
  return {
    query: (sql: string, params?: unknown[]) => dbQuery(sql, params),
    release: () => {},
  };
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({
    query: dbQuery,
    connect: async () => makeClient(),
  }),
  getDbRead: () => ({ query: dbQuery }),
}));

const runImageMock = vi.fn();
const runVideoMock = vi.fn();
const persistAssetMock = vi.fn();
const buildRunDirNameMock = vi.fn(() => 'run-fixed-flux-kontext');

vi.mock('./asset-generator', () => ({
  runImage: (...args: unknown[]) => runImageMock(...args),
  runVideo: (...args: unknown[]) => runVideoMock(...args),
  persistAsset: (...args: unknown[]) => persistAssetMock(...args),
  buildRunDirName: () => buildRunDirNameMock(),
  FALLBACK_PROMPTS: {
    hero: 'FALLBACK_HERO',
    cutout: 'FALLBACK_CUTOUT',
    lifestyles: ['FALLBACK_L1', 'FALLBACK_L2', 'FALLBACK_L3'],
    promo: 'FALLBACK_PROMO',
  },
}));

const trackedMessageMock = vi.fn();
vi.mock('./anthropic', () => ({
  trackedMessage: (...args: unknown[]) => trackedMessageMock(...args),
}));

// Comfy config toggle. The regenerator gates on `isComfyConfigured()` —
// stub it directly so we don't have to juggle env vars per-test.
const isComfyConfiguredMock = vi.fn(() => true);
vi.mock('./comfy-client', () => ({
  isComfyConfigured: () => isComfyConfiguredMock(),
}));

// fal.ai is the alternative backend. The regenerator falls back to it when
// Comfy is absent; we stub both off for the "no backend" case.
const isFalConfiguredMock = vi.fn(() => false);
vi.mock('./fal-client', () => ({
  isFalConfigured: () => isFalConfiguredMock(),
}));

beforeEach(() => {
  captured.length = 0;
  rowsByPattern.length = 0;
  runImageMock.mockReset();
  runVideoMock.mockReset();
  persistAssetMock.mockReset();
  trackedMessageMock.mockReset();
  isComfyConfiguredMock.mockReturnValue(true);
  isFalConfiguredMock.mockReturnValue(false);

  // Default store + product fixtures. Individual tests can override.
  setRows('FROM dropship_stores\n      WHERE id', [
    {
      id: 'store-1',
      slug: 'maison-chic',
      name: 'Maison Chic',
      niche: 'home decor',
      lifestyle_images: [],
    },
  ]);
  setRows('FROM dropship_store_products', [
    {
      enriched_title: 'Lampe en céramique',
      enriched_description: 'Une lampe artisanale.',
      image_url: 'https://supplier.example/lamp.jpg',
    },
  ]);
  // INSERT returning id — match on the INSERT clause.
  setRows('INSERT INTO dropship_asset_runs', [{ id: 'run-new-1' }]);

  runImageMock.mockResolvedValue({ bytes: Buffer.from('img'), runId: 'comfy-1' });
  runVideoMock.mockResolvedValue({ bytes: Buffer.from('vid'), runId: 'comfy-v' });
  persistAssetMock.mockResolvedValue('https://pub.example/maison-chic/run-fixed-flux-kontext/hero.png');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('regenerateAsset', () => {
  it('throws when no backend is configured (neither ComfyUI nor fal.ai)', async () => {
    isComfyConfiguredMock.mockReturnValue(false);
    isFalConfiguredMock.mockReturnValue(false);
    const { regenerateAsset } = await import('./asset-regenerator');
    await expect(
      regenerateAsset({ storeId: 'store-1', kind: 'hero' }),
    ).rejects.toThrow(/Aucun backend/);
    // No DB writes should have happened.
    expect(captured.find((q) => q.sql.includes('INSERT INTO dropship_asset_runs'))).toBeUndefined();
  });

  it('uses customPrompt verbatim and skips the Claude call', async () => {
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({
      storeId: 'store-1',
      kind: 'hero',
      customPrompt: 'My custom hero prompt',
    });

    expect(trackedMessageMock).not.toHaveBeenCalled();
    // The INSERT should have the custom prompt as param[2].
    const insert = captured.find((q) => q.sql.includes('INSERT INTO dropship_asset_runs'));
    expect(insert).toBeDefined();
    expect(insert!.params[2]).toBe('My custom hero prompt');
    // runImage was called with that exact prompt.
    expect(runImageMock).toHaveBeenCalledWith(
      'COMFY_DEPLOYMENT_HERO',
      'My custom hero prompt',
      'https://supplier.example/lamp.jpg',
    );
  });

  it('calls Claude to derive a prompt when customPrompt is absent', async () => {
    trackedMessageMock.mockResolvedValue({
      content: [{ type: 'text', text: '{"prompt": "Claude-written cinematic hero"}' }],
      usage: { input_tokens: 100, output_tokens: 30 },
    });
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({ storeId: 'store-1', kind: 'hero' });

    expect(trackedMessageMock).toHaveBeenCalledTimes(1);
    const call = trackedMessageMock.mock.calls[0]!;
    // Step label encodes the asset kind for the AI runs ledger.
    expect((call[0] as { step: string }).step).toBe('asset-regen-prompt:hero');
    // Prompt passed to runImage is the one Claude returned.
    expect(runImageMock).toHaveBeenCalledWith(
      'COMFY_DEPLOYMENT_HERO',
      'Claude-written cinematic hero',
      'https://supplier.example/lamp.jpg',
    );
  });

  it('inserts a run row, marks it success and is_current=true after a hero run', async () => {
    persistAssetMock.mockResolvedValue('https://pub.example/maison-chic/run-fixed/hero.png');
    const { regenerateAsset } = await import('./asset-regenerator');
    const out = await regenerateAsset({
      storeId: 'store-1',
      kind: 'hero',
      customPrompt: 'p',
    });

    expect(out.runId).toBe('run-new-1');
    expect(out.url).toBe('https://pub.example/maison-chic/run-fixed/hero.png');

    // 1) row inserted as 'running' with the resolved prompt
    const insert = captured.find((q) => q.sql.includes('INSERT INTO dropship_asset_runs'));
    expect(insert).toBeDefined();
    expect(insert!.sql).toMatch(/'running'/);

    // 2) success update by id
    const successUpdate = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes("SET status = 'success'"),
    );
    expect(successUpdate).toBeDefined();
    expect(successUpdate!.params).toContain('run-new-1');

    // 3) promotion sequence — demote + promote
    const promote = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes('SET is_current = true'),
    );
    expect(promote).toBeDefined();
    expect(promote!.params).toContain('run-new-1');
  });

  it('demotes the previous is_current row before promoting the new one', async () => {
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({ storeId: 'store-1', kind: 'hero', customPrompt: 'p' });

    const demote = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes('SET is_current = false'),
    );
    const promote = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes('SET is_current = true'),
    );
    expect(demote).toBeDefined();
    expect(promote).toBeDefined();

    const demoteIdx = captured.indexOf(demote!);
    const promoteIdx = captured.indexOf(promote!);
    expect(demoteIdx).toBeLessThan(promoteIdx);

    // Demote scoped by (store_id, asset_kind).
    expect(demote!.params).toEqual(['store-1', 'hero']);
  });

  it('updates dropship_stores.hero_image_url after a hero regeneration', async () => {
    persistAssetMock.mockResolvedValue('https://pub.example/hero-new.png');
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({ storeId: 'store-1', kind: 'hero', customPrompt: 'p' });

    const storeUpdate = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes('hero_image_url'),
    );
    expect(storeUpdate).toBeDefined();
    expect(storeUpdate!.params).toEqual(['https://pub.example/hero-new.png', 'store-1']);
    // assets_status is bumped to 'ready' on the same UPDATE.
    expect(storeUpdate!.sql).toMatch(/assets_status\s*=\s*'ready'/);
  });

  it('replaces the right lifestyle slot in the lifestyle_images JSONB array', async () => {
    // Override store fixture: an existing lifestyle array.
    rowsByPattern.length = 0;
    setRows('FROM dropship_stores\n      WHERE id', [
      {
        id: 'store-1',
        slug: 'maison-chic',
        name: 'Maison Chic',
        niche: 'home decor',
        lifestyle_images: ['old-1', 'old-2', 'old-3'],
      },
    ]);
    setRows('FROM dropship_store_products', [
      {
        enriched_title: 'Lampe en céramique',
        enriched_description: 'Une lampe artisanale.',
        image_url: 'https://supplier.example/lamp.jpg',
      },
    ]);
    setRows('INSERT INTO dropship_asset_runs', [{ id: 'run-life-2' }]);
    // The SELECT inside applyAssetToStore reads lifestyle_images again.
    setRows('SELECT lifestyle_images FROM dropship_stores', [
      { lifestyle_images: ['old-1', 'old-2', 'old-3'] },
    ]);

    persistAssetMock.mockResolvedValue('https://pub.example/lifestyle-2-new.png');
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({
      storeId: 'store-1',
      kind: 'lifestyle-2',
      customPrompt: 'p',
    });

    const storeUpdate = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes('lifestyle_images'),
    );
    expect(storeUpdate).toBeDefined();
    // First param is the JSONB payload — slot 1 (lifestyle-2) replaced.
    const payload = JSON.parse(storeUpdate!.params[0] as string) as string[];
    expect(payload).toEqual(['old-1', 'https://pub.example/lifestyle-2-new.png', 'old-3']);
  });

  it('on error: writes status=error + error_message and never touches dropship_stores', async () => {
    runImageMock.mockRejectedValue(new Error('comfy-deploy queue failed: 503'));
    const { regenerateAsset } = await import('./asset-regenerator');
    await expect(
      regenerateAsset({ storeId: 'store-1', kind: 'hero', customPrompt: 'p' }),
    ).rejects.toThrow(/503/);

    const errorUpdate = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes("SET status = 'error'"),
    );
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate!.params[0]).toMatch(/comfy-deploy queue failed: 503/);

    // No UPDATE on dropship_stores should have happened.
    const storeUpdate = captured.find((q) => q.sql.includes('UPDATE dropship_stores'));
    expect(storeUpdate).toBeUndefined();

    // is_current promotion should NOT have happened either.
    const promote = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_asset_runs') &&
        q.sql.includes('SET is_current = true'),
    );
    expect(promote).toBeUndefined();
  });

  it('routes the promo kind through runVideo (not runImage) with the video deployment key', async () => {
    persistAssetMock.mockResolvedValue('https://pub.example/promo.mp4');
    const { regenerateAsset } = await import('./asset-regenerator');
    await regenerateAsset({
      storeId: 'store-1',
      kind: 'promo',
      customPrompt: 'slow camera move',
    });

    expect(runVideoMock).toHaveBeenCalledWith(
      'COMFY_DEPLOYMENT_VIDEO',
      'slow camera move',
      'https://supplier.example/lamp.jpg',
    );
    expect(runImageMock).not.toHaveBeenCalled();

    const storeUpdate = captured.find(
      (q) =>
        q.sql.includes('UPDATE dropship_stores') &&
        q.sql.includes('promo_video_url'),
    );
    expect(storeUpdate).toBeDefined();
    expect(storeUpdate!.params[0]).toBe('https://pub.example/promo.mp4');
  });
});
