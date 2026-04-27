import { getDb } from '@/lib/db';

/**
 * Tiny Postgres-backed sliding-bucket rate limiter.
 *
 * Usage:
 *   const r = await checkRateLimit(`create-store:${ip}`, { max: 5, windowSec: 60 });
 *   if (!r.ok) return new Response('rate limited', { status: 429 });
 *
 * Behaviour:
 * - One bucket per `floor(now / windowSec)`. Atomic UPSERT bumps the counter so
 *   concurrent requests can't race past the limit.
 * - Once we cross `max`, subsequent calls in the same bucket return ok=false
 *   without further DB writes (the SQL still runs, but it's still a single
 *   round-trip — no Redis to add to the stack).
 * - Old buckets are trimmed opportunistically (~1 sweep per 100 calls). This is
 *   cheap because of `idx_rate_limits_bucket` and keeps the table tiny.
 */
export async function checkRateLimit(
  key: string,
  opts: { max: number; windowSec?: number },
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  const windowSec = opts.windowSec ?? 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const db = getDb();

  const { rows } = await db.query<{ count: number }>(
    `INSERT INTO dropship_rate_limits (key, bucket, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, bucket)
       DO UPDATE SET count = dropship_rate_limits.count + 1
     RETURNING count`,
    [key, bucket],
  );
  const count = rows[0]?.count ?? 1;

  // Cheap probabilistic GC of expired buckets.
  if (Math.random() < 0.01) {
    db.query(`DELETE FROM dropship_rate_limits WHERE bucket < $1`, [bucket - 5]).catch(() => {});
  }

  const remaining = Math.max(0, opts.max - count);
  const retryAfterSec = (bucket + 1) * windowSec - nowSec;
  return { ok: count <= opts.max, remaining, retryAfterSec };
}

/** Best-effort client IP extraction. Vercel sets x-forwarded-for. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
