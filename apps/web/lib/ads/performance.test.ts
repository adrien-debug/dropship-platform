/**
 * Coverage for getCampaignPerformance.
 * - returns [] when no campaigns
 * - aggregates views/atcs/purchases/revenue per campaign
 * - SQL respects the utm_campaign join pattern
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];
let cannedRows: unknown[] = [];

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });
  return Promise.resolve({ rows: cannedRows as T[], rowCount: cannedRows.length });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

beforeEach(() => {
  captured.length = 0;
  cannedRows = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('performance', () => {
  it('returns [] for a store with no campaigns', async () => {
    const { getCampaignPerformance } = await import('./performance');
    const result = await getCampaignPerformance('store-1');
    expect(result).toEqual([]);
  });

  it('aggregates rows and computes CTR / ROAS / CPA', async () => {
    cannedRows = [
      {
        campaign_id: 'c1',
        channel: 'meta',
        external_id: 'meta-123',
        variant_id: 'v1',
        hook: 'Élégance brute',
        status: 'live',
        daily_budget_eur: 50,
        created_at: '2026-05-01T00:00:00Z',
        pushed_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), // 5 days ago
        views: '120',
        atcs: '24',
        purchases: '6',
        revenue_cents: '180000', // 1800 €
      },
    ];

    const { getCampaignPerformance } = await import('./performance');
    const result = await getCampaignPerformance('store-1');
    expect(result.length).toBe(1);
    const row = result[0]!;
    expect(row.channel).toBe('meta');
    expect(row.views).toBe(120);
    expect(row.atcs).toBe(24);
    expect(row.purchases).toBe(6);
    expect(row.revenueCents).toBe(180000);
    expect(row.ctr).toBeCloseTo(24 / 120, 5);
    // Spend ≈ 50 € × 5-6 days = 250-300 €. ROAS = 1800/spend ≈ 6-7.2.
    expect(row.roas).toBeGreaterThanOrEqual(5);
    expect(row.roas).toBeLessThanOrEqual(8);
    // CPA = spend/6 ≈ 41-50 €.
    expect(row.cpa).toBeGreaterThan(30);
    expect(row.cpa).toBeLessThan(60);
  });

  it('joins funnel events through the deterministic utm_campaign naming', async () => {
    cannedRows = [];
    const { getCampaignPerformance } = await import('./performance');
    await getCampaignPerformance('store-7');
    const sql = captured[0]!.sql;
    expect(sql).toMatch(/dropship_ad_campaigns/);
    expect(sql).toMatch(/JOIN dropship_ad_variants/);
    expect(sql).toMatch(/LEFT JOIN dropship_funnel_events/);
    expect(sql).toMatch(/utm_campaign = 'dsv-' \|\|/);
    expect(captured[0]!.params).toEqual(['store-7']);
  });
});
