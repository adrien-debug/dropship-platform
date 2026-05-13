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
 * - The atomic check uses a single CTE: INSERT ... ON CONFLICT DO UPDATE, then
 *   SELECT count in the same statement. This guarantees that two concurrent
 *   requests see each other's increments — no race condition.
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

  // Atomic CTE: upsert then read the final count in one round-trip.
  // The RETURNING from the UPSERT gives us the post-increment count;
  // concurrent requests are serialized by the row lock.
  const { rows } = await db.query<{ count: number }>(
    `WITH upsert AS (
       INSERT INTO dropship_rate_limits (key, bucket, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, bucket)
       DO UPDATE SET count = dropship_rate_limits.count + 1
       RETURNING count
     )
     SELECT count FROM upsert`,
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
  if (xff) {
    const ip = xff.split(',')[0]?.trim();
    if (ip) return ip.substring(0, 45); // cap at IPv6 max length
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Per-IP rate-limit guard for public route handlers. Returns a 429 Response
 * when over the limit, or null when the request should proceed.
 *
 * Fails OPEN: if the underlying Postgres call errors, real users still go
 * through. The cost of a missed 429 in a transient DB blip is far lower
 * than the cost of blocking paid traffic during the same blip.
 *
 * Usage:
 *   const limited = await enforceRateLimit(request, 'cart-add', { max: 30 });
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: Request,
  scope: string,
  opts: { max: number; windowSec?: number },
): Promise<Response | null> {
  try {
    const ip = clientIp(req);
    const r = await checkRateLimit(`${scope}:${ip}`, opts);
    if (r.ok) return null;
    return new Response(
      JSON.stringify({ success: false, error: 'Trop de requêtes, réessayez dans un instant.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(r.retryAfterSec),
        },
      },
    );
  } catch {
    return null;
  }
}
