/**
 * Live KPIs surfaced in the admin sub-header. Every admin page calls
 * this once during render so the header is always fresh — it costs a
 * single round-trip on the read replica, queries are cheap aggregates,
 * and we fail-soft if any of them error out so the chrome never crashes
 * the page.
 */
import { getDbRead } from '@/lib/db';

export interface HeaderStats {
  activeStores: number;
  productsTotal: number;
  revenue7dCents: number;
  orders30d: number;
  aiRuns30d: number;
  aiCost30dEur: number;
}

const ZERO: HeaderStats = {
  activeStores: 0,
  productsTotal: 0,
  revenue7dCents: 0,
  orders30d: 0,
  aiRuns30d: 0,
  aiCost30dEur: 0,
};

export async function getHeaderStats(): Promise<HeaderStats> {
  try {
    const db = getDbRead();
    const [stores, revenue, ai] = await Promise.all([
      db.query<{ active: number; products: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'active')::int AS active,
           COALESCE(SUM(product_count) FILTER (WHERE status = 'active'), 0)::int AS products
         FROM dropship_stores`,
      ),
      db.query<{ revenue_7d: number; orders_30d: number }>(
        `SELECT
           COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days'), 0)::bigint AS revenue_7d,
           COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS orders_30d
         FROM dropship_funnel_events`,
      ),
      db.query<{ runs: number; cost: string }>(
        `SELECT
           COUNT(*)::int AS runs,
           COALESCE(SUM(cost_eur), 0)::numeric(12,4)::text AS cost
         FROM dropship_ai_runs
         WHERE created_at > now() - interval '30 days'`,
      ),
    ]);

    return {
      activeStores: stores.rows[0]?.active ?? 0,
      productsTotal: stores.rows[0]?.products ?? 0,
      revenue7dCents: Number(revenue.rows[0]?.revenue_7d ?? 0),
      orders30d: revenue.rows[0]?.orders_30d ?? 0,
      aiRuns30d: ai.rows[0]?.runs ?? 0,
      aiCost30dEur: Number(ai.rows[0]?.cost ?? 0),
    };
  } catch (err) {
    console.error('[header-stats] query failed:', err);
    return ZERO;
  }
}
