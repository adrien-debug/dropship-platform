/** Mirrors backend CRM aggregates for shop BFF (no cross-package import). */

export const EXCLUDED_LTV_STATUSES = new Set(['cancelled', 'refunded']);

export interface OrderAmountRow {
  amount_total: string | number;
  status: string;
}

export function computeLifetimeValueEur(orders: OrderAmountRow[]): number {
  let sum = 0;
  for (const o of orders) {
    if (EXCLUDED_LTV_STATUSES.has(o.status)) continue;
    const n = typeof o.amount_total === 'number' ? o.amount_total : parseFloat(String(o.amount_total));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

export function countBillableOrders(orders: Pick<OrderAmountRow, 'status'>[]): number {
  return orders.filter(o => !EXCLUDED_LTV_STATUSES.has(o.status)).length;
}

export function lastOrderPlacedAt(orders: { placed_at: string; status: string }[]): string | null {
  const eligible = orders.filter(o => !EXCLUDED_LTV_STATUSES.has(o.status));
  if (eligible.length === 0) return null;
  let max = 0;
  let best: string | null = null;
  for (const o of eligible) {
    const t = Date.parse(o.placed_at);
    if (Number.isFinite(t) && t >= max) {
      max = t;
      best = o.placed_at;
    }
  }
  return best;
}
