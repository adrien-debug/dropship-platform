import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { runAnomalyWatch } from '@/lib/ops/anomaly-watch';

/**
 * P1.3 — Order anomaly watcher cron endpoint.
 *
 * Triggered daily at 08:00 UTC by `.github/workflows/order-anomaly-watch.yml`.
 * Sits behind the admin Basic auth middleware (`/api/agent/*` matcher in
 * `apps/web/middleware.ts`).
 *
 * The scanning logic lives in `lib/ops/anomaly-watch.ts` so the admin orders
 * page can render the same payload server-side without a network round-trip.
 *
 * When `total > 0` we emit a Sentry warning so the founder is alerted even if
 * the GitHub Actions runner skips a window (free runners can drop crons under
 * load). The cron itself opens a dedicated GH issue with the full markdown.
 *
 * No retry: the situation is human-resolved by definition. A second run
 * tomorrow catches anything still pending.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Allow a generous margin in case Medusa cold-starts; 3 SQL reads + a Medusa
// admin/orders call should comfortably finish under 10s.
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await runAnomalyWatch();

    if (result.total > 0) {
      Sentry.captureMessage('anomaly-watch', {
        level: 'warning',
        tags: { feature: 'order_anomaly_watch', cron: 'p1_3' },
        extra: {
          total: result.total,
          counts: result.counts,
          // Cap each list to its first 10 IDs to keep the Sentry event under
          // the 200 KB limit when a backlog blows up.
          stranded_ids: result.stranded.slice(0, 10).map((r) => r.medusa_order_id),
          stuck_ids: result.stuck.slice(0, 10).map((r) => r.medusa_order_id),
          error_ids: result.errors.slice(0, 10).map((r) => r.medusa_order_id),
          warnings: result.warnings,
        },
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { feature: 'order_anomaly_watch', cron: 'p1_3' },
    });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
