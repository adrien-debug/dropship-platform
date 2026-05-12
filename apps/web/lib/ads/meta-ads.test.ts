/**
 * Coverage for the Meta Ads push helper.
 * - fail-soft when env vars missing
 * - payload shape (campaign + adset + ad)
 * - fetch error → 'error' status row inserted
 * - happy path → 'live' status with external_id
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const inserted: CapturedQuery[] = [];

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  if (/^\s*INSERT\b/i.test(sql)) {
    inserted.push({ sql, params: params ?? [] });
    if (/RETURNING\s+id/i.test(sql)) {
      return Promise.resolve({
        rows: [{ id: `cmp-${inserted.length}` } as unknown as T],
        rowCount: 1,
      });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

beforeEach(() => {
  inserted.length = 0;
  delete process.env.META_ADS_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('meta-ads', () => {
  it('fail-soft: inserts a draft row when OAuth env vars are missing', async () => {
    const { pushMetaCampaign } = await import('./meta-ads');
    const result = await pushMetaCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: 'Acheter',
      imageUrl: null,
      productUrl: 'https://x/shop/maison-chic/products/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('draft');
    expect(result.externalId).toBeNull();
    expect(result.error).toMatch(/not configured/i);
    expect(inserted.length).toBe(1);
    // status param: index 7 in the draft-branch INSERT (variant_id=2, channel='meta', status=position 7? Let's check by SQL).
    expect(inserted[0]!.sql).toMatch(/'draft'/);
  });

  it('builds a payload with deterministic campaign name + UTM-tagged link', async () => {
    const { buildMetaPayload, metaCampaignName } = await import('./meta-ads');
    const payload = buildMetaPayload({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: 'D',
      cta: 'Acheter',
      imageUrl: 'https://img/h.png',
      productUrl: 'https://x.example.com/shop/maison-chic/products/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(payload.campaign.name).toBe('dsv-maison-chic-v1');
    expect(payload.campaign.objective).toBe('OUTCOME_SALES');
    expect(metaCampaignName('maison-chic', 'v1')).toBe('dsv-maison-chic-v1');
    const linkData = (payload.ad.creative as {
      object_story_spec: { link_data: { link: string; call_to_action?: { type: string } } };
    }).object_story_spec.link_data;
    expect(linkData.link).toMatch(/utm_campaign=dsv-maison-chic-v1/);
    expect(linkData.call_to_action?.type).toBe('SHOP_NOW');
  });

  it('records an error row when the Meta fetch throws', async () => {
    process.env.META_ADS_ACCESS_TOKEN = 'tok';
    process.env.META_AD_ACCOUNT_ID = '123';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Boom', { status: 500 })),
    );

    const { pushMetaCampaign } = await import('./meta-ads');
    const result = await pushMetaCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: 'Acheter',
      imageUrl: null,
      productUrl: 'https://x/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('error');
    expect(result.externalId).toBeNull();
    expect(result.error).toMatch(/Meta API 500/);
    expect(inserted.some((r) => /'error'/.test(r.sql))).toBe(true);
  });

  it('happy path: live status with external_id when fetch succeeds', async () => {
    process.env.META_ADS_ACCESS_TOKEN = 'tok';
    process.env.META_AD_ACCOUNT_ID = '123';
    const ids = ['camp-99', 'adset-77', 'ad-55'];
    let i = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ id: ids[i++] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { pushMetaCampaign } = await import('./meta-ads');
    const result = await pushMetaCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: 'Acheter',
      imageUrl: null,
      productUrl: 'https://x/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('live');
    expect(result.externalId).toBe('camp-99');
    expect(inserted.some((r) => /'live'/.test(r.sql))).toBe(true);
  });
});
