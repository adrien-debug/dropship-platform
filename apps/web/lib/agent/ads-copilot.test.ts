/**
 * Vitest coverage for the ads copilot.
 *
 * Same mock surface as curation-copilot.test.ts:
 *   - @/lib/db                : in-memory query capture with canned rows.
 *   - ./fal-client            : falGenerateImage stubbed to return a fixed buffer.
 *   - @/lib/storage/r2        : isR2Configured + uploadToR2 stubbed.
 *   - ./anthropic             : trackedMessage replaced by a programmable queue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];
const rowsBySubstring: { pattern: string; rows: unknown[] }[] = [];
const inserted: { table: string; sql: string; params: unknown[] }[] = [];
const updated: { sql: string; params: unknown[] }[] = [];

function setRows(pattern: string, rows: unknown[]) {
  rowsBySubstring.push({ pattern, rows });
}

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });

  if (/^\s*INSERT\b/i.test(sql)) {
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    inserted.push({ table: tableMatch?.[1] ?? 'unknown', sql, params: params ?? [] });
    if (/RETURNING\s+id/i.test(sql)) {
      const id = `gen-${inserted.length.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
      return Promise.resolve({ rows: [{ id } as unknown as T], rowCount: 1 });
    }
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    updated.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }

  for (const { pattern, rows } of rowsBySubstring) {
    if (sql.includes(pattern)) {
      return Promise.resolve({ rows: rows as T[], rowCount: rows.length });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

const falGenerateImageMock = vi.fn();
vi.mock('./fal-client', () => ({
  falGenerateImage: (...args: unknown[]) => falGenerateImageMock(...args),
}));

const uploadToR2Mock = vi.fn();
const isR2ConfiguredMock = vi.fn(() => true);
vi.mock('@/lib/storage/r2', () => ({
  uploadToR2: (...args: unknown[]) => uploadToR2Mock(...args),
  isR2Configured: (...args: unknown[]) => isR2ConfiguredMock(...args),
}));

interface CannedAnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

const anthropicResponseQueue: CannedAnthropicResponse[] = [];
const trackedMessageMock = vi.fn(async () => {
  const next = anthropicResponseQueue.shift();
  if (!next) {
    throw new Error('No queued Anthropic response — test misconfigured.');
  }
  return next;
});
vi.mock('./anthropic', () => ({
  trackedMessage: (...args: unknown[]) => trackedMessageMock(...args),
}));

function reset() {
  captured.length = 0;
  rowsBySubstring.length = 0;
  inserted.length = 0;
  updated.length = 0;
  anthropicResponseQueue.length = 0;
  falGenerateImageMock.mockReset();
  uploadToR2Mock.mockReset();
  isR2ConfiguredMock.mockReset();
  isR2ConfiguredMock.mockReturnValue(true);
  trackedMessageMock.mockClear();
}

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function seedStore() {
  setRows('FROM dropship_stores WHERE id = $1 LIMIT 1', [
    { id: STORE_ID, slug: 'maison-chic', name: 'Maison Chic', niche: 'décoration' },
  ]);
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

beforeEach(() => {
  reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ads-copilot', () => {
  it('inserts user + assistant messages when Claude returns plain text', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Salut, sur quoi on travaille ?' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    const events = await drain(runAdsTurn(STORE_ID, 'sess-1', 'Bonjour'));

    const msgInserts = inserted.filter((i) => i.table === 'dropship_curation_messages');
    expect(msgInserts.length).toBe(2);
    expect(msgInserts[0]!.params[1]).toBe('user');
    expect(msgInserts[1]!.params[1]).toBe('assistant');
    expect(events.map((e) => e.type)).toContain('done');
  });

  it('list_variants returns variants grouped by channel', async () => {
    seedStore();
    setRows('FROM dropship_ad_variants v', [
      {
        id: 'v1', product_id: 'p1', product_title: 'Vase ceramic',
        channel: 'meta', headline: 'Élégance brute', primary_text: 'Texte 1',
        description: 'Livraison FR', cta: 'Acheter', meta: null,
        targeting_json: null, created_at: '2026-05-01',
      },
      {
        id: 'v2', product_id: 'p1', product_title: 'Vase ceramic',
        channel: 'tiktok', headline: 'POV : t’as trouvé LA pièce',
        primary_text: 'Texte 2', description: null, cta: 'Voir', meta: null,
        targeting_json: null, created_at: '2026-05-01',
      },
    ]);

    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu_lv', name: 'list_variants', input: {} }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Voici les variantes.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    await drain(runAdsTurn(STORE_ID, 'sess-2', 'liste les variantes'));

    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.variants.length).toBe(2);
    expect(out.by_channel.meta.length).toBe(1);
    expect(out.by_channel.tiktok.length).toBe(1);
  });

  it('rewrite_hook updates the ad variant row in the DB', async () => {
    seedStore();
    const VARIANT_ID = '22222222-2222-4222-8222-222222222222';
    setRows('SELECT v.id, v.channel, v.headline', [
      {
        id: VARIANT_ID, channel: 'meta',
        headline: 'Original', primary_text: 'Texte', description: 'D', cta: 'CTA',
        product_id: 'p1', product_title: 'Vase', product_description: 'Vase en céramique',
      },
    ]);

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_rh', name: 'rewrite_hook',
        input: { variant_id: VARIANT_ID, instruction: 'plus agressif' },
      }],
      stop_reason: 'tool_use',
    });
    // Inner Claude call for the rewrite returns the new copy.
    anthropicResponseQueue.push({
      content: [{
        type: 'text',
        text: '{"headline": "Plus jamais ennuyeux", "primary_text": "Tu rentres, ils s’arrêtent.", "description": "Livraison FR", "cta": "Acheter"}',
      }],
      stop_reason: 'end_turn',
    });
    // Outer end-turn.
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Réécrit.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    await drain(runAdsTurn(STORE_ID, 'sess-3', 'plus agressif sur meta'));

    const updatedVariants = updated.filter((u) => /UPDATE dropship_ad_variants/.test(u.sql) && /SET headline/.test(u.sql));
    expect(updatedVariants.length).toBe(1);
    expect(updatedVariants[0]!.params[0]).toBe('Plus jamais ennuyeux');
    expect(updatedVariants[0]!.params[4]).toBe(VARIANT_ID);
  });

  it('generate_visual calls fal + uploadToR2 and updates the variant', async () => {
    seedStore();
    const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
    setRows('SELECT v.id, v.channel, v.headline, v.primary_text, v.meta', [
      {
        id: VARIANT_ID, channel: 'tiktok', headline: 'Hook',
        primary_text: 'Texte', meta: null,
        product_title: 'Vase', product_image_url: 'https://img/v.jpg',
      },
    ]);
    falGenerateImageMock.mockResolvedValue(Buffer.from('PNGFAKE'));
    uploadToR2Mock.mockResolvedValue('https://r2.example.com/maison-chic/ads/x.png');

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_gv', name: 'generate_visual',
        input: { variant_id: VARIANT_ID, prompt: 'Lifestyle bold' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Visuel ok.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    await drain(runAdsTurn(STORE_ID, 'sess-4', 'génère un visuel'));

    expect(falGenerateImageMock).toHaveBeenCalledTimes(1);
    expect(uploadToR2Mock).toHaveBeenCalledTimes(1);
    const updatedMeta = updated.find((u) => /SET meta/i.test(u.sql) && u.params[1] === VARIANT_ID);
    expect(updatedMeta).toBeDefined();
    const meta = JSON.parse(String(updatedMeta!.params[0]));
    expect(meta.image_url).toBe('https://r2.example.com/maison-chic/ads/x.png');
  });

  it('suggest_targeting writes targeting_json on every matching variant', async () => {
    seedStore();
    const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
    setRows('SELECT id, enriched_title, enriched_description', [
      { id: PRODUCT_ID, enriched_title: 'Vase', enriched_description: 'Vase en céramique.' },
    ]);

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_st', name: 'suggest_targeting',
        input: { product_id: PRODUCT_ID, channel: 'meta' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{
        type: 'text',
        text: '{"age_min":25,"age_max":55,"genders":[2],"interests":["déco","intérieur"],"locations":["FR"],"placements":["feed","stories"],"recommended_daily_budget_eur":35}',
      }],
      stop_reason: 'end_turn',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Ciblage défini.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    await drain(runAdsTurn(STORE_ID, 'sess-5', 'cible meta'));

    const targetingUpdate = updated.find(
      (u) => /UPDATE dropship_ad_variants/.test(u.sql) && /SET targeting_json/.test(u.sql),
    );
    expect(targetingUpdate).toBeDefined();
    const tgt = JSON.parse(String(targetingUpdate!.params[0]));
    expect(tgt.recommended_daily_budget_eur).toBe(35);
    expect(tgt.placements).toEqual(['feed', 'stories']);
    expect(targetingUpdate!.params[3]).toBe('meta'); // channel filter
  });

  it('estimate_budget returns CPM/ROAS shape per channel', async () => {
    seedStore();
    const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_eb', name: 'estimate_budget',
        input: { product_id: PRODUCT_ID, daily_budget_eur: 50, days: 10 },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Estimation.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    await drain(runAdsTurn(STORE_ID, 'sess-6', 'estime mon budget'));

    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.daily_budget_eur).toBe(50);
    expect(out.days).toBe(10);
    expect(out.breakdown).toHaveLength(3);
    const meta = out.breakdown.find((b: { channel: string }) => b.channel === 'meta');
    expect(meta).toBeDefined();
    expect(meta.expected_clicks).toBeGreaterThan(0);
    expect(meta.expected_purchases).toBeGreaterThanOrEqual(0);
  });

  it('tool error is recorded and the loop continues to end_turn', async () => {
    seedStore();
    // rewrite_hook on unknown variant should throw "introuvable".
    setRows('SELECT v.id, v.channel, v.headline', []);

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_err', name: 'rewrite_hook',
        input: { variant_id: '99999999-9999-4999-8999-999999999999', instruction: 'plus émotionnel' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Je n’ai pas pu, désolé.' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    const events = await drain(runAdsTurn(STORE_ID, 'sess-7', 'mauvais id'));

    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.error).toMatch(/introuvable/);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('createAdsSession inserts a row into dropship_curation_sessions', async () => {
    seedStore();
    const { createAdsSession } = await import('./ads-copilot');
    const id = await createAdsSession(STORE_ID);
    expect(id).toBeTruthy();
    const inserts = inserted.filter((i) => i.table === 'dropship_curation_sessions');
    expect(inserts.length).toBe(1);
    expect(inserts[0]!.params[0]).toBe(STORE_ID);
  });

  it('emits an error event when the store is missing', async () => {
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'irrelevant' }],
      stop_reason: 'end_turn',
    });

    const { runAdsTurn } = await import('./ads-copilot');
    const events = await drain(runAdsTurn(STORE_ID, 'sess-8', 'hello'));
    expect(trackedMessageMock).not.toHaveBeenCalled();
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    anthropicResponseQueue.length = 0;
  });
});
