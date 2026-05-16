import { NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/stores/:id/metrics
 *
 * Returns per-store metrics for the right context panel:
 *   - revenue (7d, 30d)
 *   - orders (7d, 30d)
 *   - average order value
 *   - conversion rate (funnel)
 *   - top products by revenue
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const db = getDbRead();

  // Verify store exists and get slug
  const storeRes = await db.query<{ slug: string; name: string; status: string }>(
    `SELECT slug, name, status FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Revenue & orders (7d and 30d)
  const revenueRes = await db.query<{
    revenue_7d_cents: number;
    revenue_30d_cents: number;
    orders_7d: number;
    orders_30d: number;
    aov_cents: number;
  }>(
    `SELECT
       COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days'), 0)::bigint AS revenue_7d_cents,
       COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS revenue_30d_cents,
       COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days')::int AS orders_7d,
       COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS orders_30d,
       COALESCE(AVG(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS aov_cents
     FROM dropship_funnel_events
     WHERE store_slug = $1`,
    [store.slug],
  );
  const rev = revenueRes.rows[0]!;

  // Funnel for conversion rate
  const funnelRes = await db.query<{
    view_content: number;
    add_to_cart: number;
    initiate_checkout: number;
    purchase: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE event_name = 'view_content')::int AS view_content,
       COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS add_to_cart,
       COUNT(*) FILTER (WHERE event_name = 'initiate_checkout')::int AS initiate_checkout,
       COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchase
     FROM dropship_funnel_events
     WHERE store_slug = $1 AND created_at > now() - interval '30 days'`,
    [store.slug],
  );
  const funnel = funnelRes.rows[0]!;
  const conversionRate = funnel.view_content > 0
    ? (funnel.purchase / funnel.view_content) * 100
    : 0;

  // Top products by revenue
  const topProductsRes = await db.query<{
    product_name: string;
    sales: number;
    revenue_cents: number;
  }>(
    `SELECT
       COALESCE(NULLIF(f.product_name, ''), 'Produit inconnu') AS product_name,
       COUNT(*)::int AS sales,
       COALESCE(SUM(f.value_minor), 0)::bigint AS revenue_cents
     FROM dropship_funnel_events f
     WHERE f.store_slug = $1
       AND f.event_name = 'purchase'
       AND f.created_at > now() - interval '30 days'
     GROUP BY f.product_name
     ORDER BY revenue_cents DESC
     LIMIT 5`,
    [store.slug],
  );

  // Product count
  const productCountRes = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int FROM dropship_store_products WHERE store_id = $1`,
    [storeId],
  );

  return NextResponse.json({
    store: {
      id: storeId,
      slug: store.slug,
      name: store.name,
      status: store.status,
      productCount: productCountRes.rows[0]?.count ?? 0,
    },
    revenue: {
      '7d': Number(rev.revenue_7d_cents),
      '30d': Number(rev.revenue_30d_cents),
    },
    orders: {
      '7d': rev.orders_7d,
      '30d': rev.orders_30d,
    },
    aov: Number(rev.aov_cents),
    conversionRate,
    funnel: {
      viewContent: funnel.view_content,
      addToCart: funnel.add_to_cart,
      initiateCheckout: funnel.initiate_checkout,
      purchase: funnel.purchase,
    },
    topProducts: topProductsRes.rows.map((p) => ({
      name: p.product_name,
      sales: p.sales,
      revenue: Number(p.revenue_cents),
    })),
  });
}
