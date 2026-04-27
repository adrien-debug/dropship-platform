import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Mark the latest live forward of a Medusa order as paid on aliexpress.com.
 *
 * AE has no public API to detect that we paid a `ds.order.create` order, so
 * this is a manual flag from the merchant. Future: poll
 * `aliexpress.ds.order.tracking.get` — a tracking number implies the order
 * was paid, so we can flip this automatically.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { rowCount } = await getDb().query(
    `UPDATE dropship_order_forwards
        SET paid_at = now()
      WHERE id = (
        SELECT id FROM dropship_order_forwards
         WHERE medusa_order_id = $1 AND dry_run = false AND status = 'sent'
         ORDER BY created_at DESC
         LIMIT 1
      )`,
    [id],
  );

  if (!rowCount) {
    return NextResponse.json(
      { error: 'No live forward found for this order — forward to AE first.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
