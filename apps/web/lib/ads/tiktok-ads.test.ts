/**
 * Coverage for the TikTok Ads push helper. Mirrors the Meta test suite.
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
  delete process.env.TIKTOK_ADS_ACCESS_TOKEN;
  delete process.env.TIKTOK_ADVERTISER_ID;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tiktok-ads', () => {
  it('fail-soft: inserts a draft row when OAuth env vars are missing', async () => {
    const { pushTiktokCampaign } = await import('./tiktok-ads');
    const result = await pushTiktokCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: null,
      imageUrl: null,
      videoUrl: null,
      productUrl: 'https://x/shop/maison-chic/products/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('draft');
    expect(result.externalId).toBeNull();
    expect(result.error).toMatch(/not configured/i);
    expect(inserted.length).toBe(1);
    expect(inserted[0]!.sql).toMatch(/'draft'/);
    expect(inserted[0]!.sql).toMatch(/'tiktok'/);
  });

  it('builds a payload with deterministic campaign name + UTM-tagged link', async () => {
    const { buildTiktokPayload, tiktokCampaignName } = await import('./tiktok-ads');
    process.env.TIKTOK_ADVERTISER_ID = '999';
    const payload = buildTiktokPayload({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'POV',
      primaryText: 'Texte',
      description: null,
      cta: 'Voir',
      imageUrl: 'img-id',
      videoUrl: null,
      productUrl: 'https://x.example.com/shop/maison-chic/products/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(payload.campaign.campaign_name).toBe('dsv-maison-chic-v1');
    expect(tiktokCampaignName('maison-chic', 'v1')).toBe('dsv-maison-chic-v1');
    const landing = (payload.ad as { landing_page_url: string }).landing_page_url;
    expect(landing).toMatch(/utm_campaign=dsv-maison-chic-v1/);
    expect((payload.ad as { call_to_action: string }).call_to_action).toBe('VIEW_NOW');
  });

  it('records an error row when the TikTok fetch throws', async () => {
    process.env.TIKTOK_ADS_ACCESS_TOKEN = 'tok';
    process.env.TIKTOK_ADVERTISER_ID = '999';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Boom', { status: 500 })),
    );

    const { pushTiktokCampaign } = await import('./tiktok-ads');
    const result = await pushTiktokCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: null,
      imageUrl: null,
      videoUrl: null,
      productUrl: 'https://x/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('error');
    expect(result.externalId).toBeNull();
    expect(result.error).toMatch(/TikTok API 500/);
    expect(inserted.some((r) => /'error'/.test(r.sql))).toBe(true);
  });

  it('happy path: live status with external_id when fetch succeeds', async () => {
    process.env.TIKTOK_ADS_ACCESS_TOKEN = 'tok';
    process.env.TIKTOK_ADVERTISER_ID = '999';
    const responses = [
      { code: 0, data: { campaign_id: 'tt-camp-1' } },
      { code: 0, data: { adgroup_id: 'tt-adg-1' } },
      { code: 0, data: { ad_id: 'tt-ad-1' } },
    ];
    let i = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(responses[i++]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { pushTiktokCampaign } = await import('./tiktok-ads');
    const result = await pushTiktokCampaign({
      storeId: 's1',
      storeSlug: 'maison-chic',
      variantId: 'v1',
      headline: 'H',
      primaryText: 'P',
      description: null,
      cta: null,
      imageUrl: null,
      videoUrl: null,
      productUrl: 'https://x/p1',
      dailyBudgetEur: 25,
      days: 7,
    });
    expect(result.status).toBe('live');
    expect(result.externalId).toBe('tt-camp-1');
    expect(inserted.some((r) => /'live'/.test(r.sql))).toBe(true);
  });
});
