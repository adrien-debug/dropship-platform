import { getDbRead } from '@/lib/db';

/**
 * Read-side analytics for ad campaigns.
 *
 * Joins `dropship_ad_campaigns` to `dropship_funnel_events` through the
 * deterministic UTM naming `dsv-{storeSlug}-{variantId}`. The funnel
 * events table is already populated by middleware (it captures fbclid /
 * ttclid into a cookie and the storefront's checkout pipeline calls
 * `logFunnelEvent` with the parsed utm_* fields).
 *
 * Why utm_campaign rather than the channel's external_id: Meta and
 * TikTok don't pass their ad/campaign id to the landing page click — we
 * only get `fbclid` / `ttclid`. Joining those would require a roundtrip
 * to the channel's reporting API. UTM is the cheap, unambiguous join.
 */

export interface CampaignPerformanceRow {
  campaignId: string;
  channel: 'meta' | 'tiktok' | 'google';
  externalId: string | null;
  variantId: string;
  hook: string;
  status: string;
  dailyBudgetEur: number | null;
  createdAt: string;
  pushedAt: string | null;
  views: number;
  atcs: number;
  purchases: number;
  revenueCents: number;
  ctr: number; // 0..1 — atcs / views.
  cpa: number; // EUR — daily_budget * days_live / purchases; null if 0 purchases.
  roas: number; // revenue / spend_estimate; 0 if no spend yet.
}

interface QueryRow {
  campaign_id: string;
  channel: 'meta' | 'tiktok' | 'google';
  external_id: string | null;
  variant_id: string;
  hook: string;
  status: string;
  daily_budget_eur: string | number | null;
  created_at: string;
  pushed_at: string | null;
  views: string | number;
  atcs: string | number;
  purchases: string | number;
  revenue_cents: string | number;
}

/**
 * Returns one row per campaign in this store, ordered by revenue desc.
 * Empty array when the store has no campaigns yet (typical state for
 * fresh stores before any push happens).
 */
export async function getCampaignPerformance(storeId: string): Promise<CampaignPerformanceRow[]> {
  const db = getDbRead();
  const { rows } = await db.query<QueryRow>(
    `SELECT
        c.id            AS campaign_id,
        c.channel,
        c.external_id,
        c.variant_id,
        c.status,
        c.daily_budget_eur,
        c.created_at,
        c.pushed_at,
        v.headline      AS hook,
        COUNT(f.id) FILTER (WHERE f.event_name = 'view_content')           AS views,
        COUNT(f.id) FILTER (WHERE f.event_name = 'add_to_cart')            AS atcs,
        COUNT(f.id) FILTER (WHERE f.event_name = 'purchase')               AS purchases,
        COALESCE(SUM(f.value_minor) FILTER (WHERE f.event_name = 'purchase'), 0)::bigint AS revenue_cents
     FROM dropship_ad_campaigns c
     JOIN dropship_ad_variants v ON v.id = c.variant_id
     LEFT JOIN dropship_funnel_events f
            ON f.utm_campaign = 'dsv-' || (SELECT slug FROM dropship_stores WHERE id = c.store_id) || '-' || c.variant_id::text
           AND f.created_at > c.created_at
     WHERE c.store_id = $1
     GROUP BY c.id, c.channel, c.external_id, c.variant_id, c.status,
              c.daily_budget_eur, c.created_at, c.pushed_at, v.headline
     ORDER BY revenue_cents DESC, c.created_at DESC`,
    [storeId],
  );

  return rows.map((r) => {
    const views = Number(r.views) || 0;
    const atcs = Number(r.atcs) || 0;
    const purchases = Number(r.purchases) || 0;
    const revenueCents = Number(r.revenue_cents) || 0;
    const dailyBudgetEur = r.daily_budget_eur != null ? Number(r.daily_budget_eur) : null;
    const ctr = views > 0 ? atcs / views : 0;

    let spendEstimate = 0;
    if (dailyBudgetEur && r.pushed_at) {
      const daysLive = Math.max(
        1,
        Math.ceil((Date.now() - new Date(r.pushed_at).getTime()) / 86_400_000),
      );
      spendEstimate = dailyBudgetEur * daysLive;
    }
    const cpa = purchases > 0 && spendEstimate > 0 ? spendEstimate / purchases : 0;
    const roas = spendEstimate > 0 ? revenueCents / 100 / spendEstimate : 0;

    return {
      campaignId: r.campaign_id,
      channel: r.channel,
      externalId: r.external_id,
      variantId: r.variant_id,
      hook: r.hook,
      status: r.status,
      dailyBudgetEur,
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
      views,
      atcs,
      purchases,
      revenueCents,
      ctr,
      cpa,
      roas,
    };
  });
}
