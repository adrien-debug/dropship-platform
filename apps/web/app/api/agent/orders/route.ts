import { NextRequest, NextResponse } from 'next/server';
import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ForwardSummary {
  medusa_order_id: string;
  status: string;
  ae_order_id: string | null;
  dry_run: boolean;
  created_at: string;
}

/**
 * GET /api/agent/orders
 * Lists Medusa orders and joins them with their latest forward attempt.
 * Supports `?salesChannelId=` and `?limit=`.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') || '50');
  const salesChannelId = req.nextUrl.searchParams.get('salesChannelId') || undefined;

  const { orders, count } = await medusa.getOrders({ limit, salesChannelId });

  if (orders.length === 0) return NextResponse.json({ orders: [], count: 0 });

  const ids = orders.map((o) => o.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: forwards } = await getDb().query<ForwardSummary>(
    `SELECT DISTINCT ON (medusa_order_id)
            medusa_order_id, status, ae_order_id, dry_run, created_at
       FROM dropship_order_forwards
      WHERE medusa_order_id IN (${placeholders})
      ORDER BY medusa_order_id, created_at DESC`,
    ids,
  );

  const byOrderId = new Map(forwards.map((f) => [f.medusa_order_id, f]));

  return NextResponse.json({
    count,
    orders: orders.map((o) => ({
      ...o,
      forward: byOrderId.get(o.id) ?? null,
    })),
  });
}
