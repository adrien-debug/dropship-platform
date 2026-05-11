/**
 * P1.3 — Order anomaly watcher core.
 *
 * Implementation lives in a regular lib module (not the route file) because
 * Next.js' typed-route generator only accepts handler exports / static config
 * keys on `route.ts`. Both the cron endpoint and the admin orders server
 * component import `runAnomalyWatch` from here.
 *
 * Surfaces three silent failure modes the founder must act on manually:
 *
 *   1. **Stranded "awaiting payment at AE" > 15 days** — AliExpress auto-
 *      cancels a dropship order after 20 days without payment. Past 15 days
 *      the founder has a 5-day window to log in, pay, and click "Marquer
 *      payée". Past 20 days the customer order is lost.
 *
 *   2. **Stuck Stripe → forward gap > 4h** — Medusa orders captured by Stripe
 *      that never reached `dropship_order_forwards` (any row, including dry
 *      runs). Means nobody clicked the admin "Forward to AE" button.
 *
 *   3. **Forwards in `status='error'` unresolved > 48h** — usually a missing
 *      address field or unmapped product. Won't fix itself.
 */

import { getDbRead } from '@/lib/db';
import { medusa } from '@/lib/medusa';

export interface StrandedForward {
  medusa_order_id: string;
  ae_order_id: string;
  created_at: string;
  age_days: number;
}

export interface StuckOrder {
  medusa_order_id: string;
  display_id: number | null;
  email: string | null;
  total: number | null;
  currency_code: string | null;
  payment_status: string | null;
  created_at: string;
  age_hours: number;
}

export interface ErroredForward {
  medusa_order_id: string;
  error_message: string | null;
  created_at: string;
  age_hours: number;
}

export interface AnomalyWatchResult {
  ok: true;
  generated_at: string;
  total: number;
  counts: {
    stranded: number;
    stuck: number;
    errors: number;
  };
  stranded: StrandedForward[];
  stuck: StuckOrder[];
  errors: ErroredForward[];
  /** Non-fatal warnings (e.g. Medusa unreachable, partial scan). */
  warnings: string[];
}

function hoursBetween(now: Date, iso: string): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 3_600_000));
}

function daysBetween(now: Date, iso: string): number {
  return Math.floor(hoursBetween(now, iso) / 24);
}

/**
 * Run the three anomaly scans. Pure read path — never mutates DB or Medusa.
 * Safe to call from a server component (the admin orders page) and from the
 * cron POST handler.
 */
export async function runAnomalyWatch(): Promise<AnomalyWatchResult> {
  const now = new Date();
  const warnings: string[] = [];
  const db = getDbRead();

  // 1) Stranded "awaiting payment at AE" > 15 days. Same partial index
  //    `idx_order_forwards_awaiting_payment` the admin /orders page uses,
  //    so this stays cheap even on a long history.
  const { rows: strandedRows } = await db.query<{
    medusa_order_id: string;
    ae_order_id: string;
    created_at: string;
  }>(
    `SELECT medusa_order_id, ae_order_id, created_at
       FROM dropship_order_forwards
      WHERE status = 'sent'
        AND paid_at IS NULL
        AND dry_run = false
        AND ae_order_id IS NOT NULL
        AND created_at < now() - interval '15 days'
      ORDER BY created_at ASC`,
  );
  const stranded: StrandedForward[] = strandedRows.map((r) => ({
    medusa_order_id: r.medusa_order_id,
    ae_order_id: r.ae_order_id,
    created_at: r.created_at,
    age_days: daysBetween(now, r.created_at),
  }));

  // 3) Errored forwards unresolved > 48h. Pulled before #2 because it doesn't
  //    depend on Medusa being reachable — we still surface SQL-only anomalies
  //    when Medusa is sleeping.
  const { rows: errorRows } = await db.query<{
    medusa_order_id: string;
    error_message: string | null;
    created_at: string;
  }>(
    `SELECT medusa_order_id, error_message, created_at
       FROM dropship_order_forwards
      WHERE status = 'error'
        AND created_at < now() - interval '48 hours'
      ORDER BY created_at ASC`,
  );
  const errored: ErroredForward[] = errorRows.map((r) => ({
    medusa_order_id: r.medusa_order_id,
    error_message: r.error_message,
    created_at: r.created_at,
    age_hours: hoursBetween(now, r.created_at),
  }));

  // 2) Stuck Stripe → forward gap > 4h. We rely on the 50 most recent Medusa
  //    orders (same window the admin page uses) — any paid order older than
  //    that window has either been forwarded or is already lost. Joining
  //    against the full `dropship_order_forwards` table (all statuses,
  //    including dry_run) ensures we don't flag an order the founder
  //    intentionally left in dry-run.
  const stuck: StuckOrder[] = [];
  try {
    const { orders } = await medusa.getOrders({ limit: 50 });
    const paid = orders.filter(
      (o) => o.payment_status === 'captured' || o.payment_status === 'authorized',
    );
    if (paid.length > 0) {
      const ids = paid.map((o) => o.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const { rows: existing } = await db.query<{ medusa_order_id: string }>(
        `SELECT DISTINCT medusa_order_id
           FROM dropship_order_forwards
          WHERE medusa_order_id IN (${placeholders})`,
        ids,
      );
      const seen = new Set(existing.map((r) => r.medusa_order_id));
      const cutoff = now.getTime() - 4 * 3_600_000;
      for (const o of paid) {
        if (seen.has(o.id)) continue;
        const created = new Date(o.created_at).getTime();
        if (Number.isFinite(created) && created < cutoff) {
          stuck.push({
            medusa_order_id: o.id,
            display_id: o.display_id ?? null,
            email: o.email ?? null,
            total: o.total ?? null,
            currency_code: o.currency_code ?? null,
            payment_status: o.payment_status ?? null,
            created_at: o.created_at,
            age_hours: hoursBetween(now, o.created_at),
          });
        }
      }
    }
  } catch (e) {
    // Medusa might be sleeping or unreachable — log it but keep the rest of
    // the report useful. Tomorrow's scan will catch any stuck orders.
    const msg = e instanceof Error ? e.message : 'Unknown error';
    warnings.push(`medusa_unreachable: ${msg}`);
  }

  const counts = {
    stranded: stranded.length,
    stuck: stuck.length,
    errors: errored.length,
  };
  const total = counts.stranded + counts.stuck + counts.errors;

  return {
    ok: true,
    generated_at: now.toISOString(),
    total,
    counts,
    stranded,
    stuck,
    errors: errored,
    warnings,
  };
}
