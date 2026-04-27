import { NextResponse } from 'next/server';
import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import { forwardOrder } from '@/lib/agent/order-forwarder';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/agent/orders/dry-run-pending
 * For every Medusa order that has been paid (payment_status captured/authorized)
 * and has no dropship_order_forwards row yet, run a dry-run forward.
 * Never sends to AliExpress for real — that still requires a manual click in /admin/orders.
 */
export async function POST() {
  const { orders } = await medusa.getOrders({ limit: 100 });
  const eligible = orders.filter(
    (o) => o.payment_status === 'captured' || o.payment_status === 'authorized',
  );

  if (eligible.length === 0) {
    return NextResponse.json({ scanned: 0, processed: 0, results: [] });
  }

  const ids = eligible.map((o) => o.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: existing } = await getDb().query<{ medusa_order_id: string }>(
    `SELECT DISTINCT medusa_order_id FROM dropship_order_forwards WHERE medusa_order_id IN (${placeholders})`,
    ids,
  );
  const seen = new Set(existing.map((r) => r.medusa_order_id));

  const todo = eligible.filter((o) => !seen.has(o.id));

  const results = await Promise.all(
    todo.map(async (o) => {
      try {
        const r = await forwardOrder(o.id, { dryRun: true });
        return { medusaOrderId: o.id, status: r.status, ok: r.ok, error: r.error };
      } catch (e) {
        return {
          medusaOrderId: o.id,
          status: 'error' as const,
          ok: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    }),
  );

  return NextResponse.json({
    scanned: eligible.length,
    processed: results.length,
    results,
  });
}
