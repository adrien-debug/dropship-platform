import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getDb } from '@/lib/db';
import { refreshAccessTokenDetailed } from '@/lib/suppliers/aliexpress';

/**
 * QW7 — AE OAuth refresh cron endpoint.
 *
 * Triggered daily by `.github/workflows/ae-token-refresh.yml`. Behind the
 * admin Basic auth middleware (see `apps/web/middleware.ts` matcher list).
 *
 * Flow:
 *   1. Read `aliexpress_refresh_token` from `platform_settings`.
 *   2. If absent → 412 (precondition failed): nothing to refresh, the
 *      operator must re-run the OAuth flow via `/api/aliexpress/oauth/start`.
 *   3. Call `refreshAccessTokenDetailed` which signs `/auth/token/refresh`
 *      (HMAC-SHA256) and persists the new access token + expiry.
 *   4. On AE error → 500 with detail, Sentry-captured.
 *
 * Why a dedicated endpoint? `getAccessToken()` already refreshes lazily on
 * read, but if no traffic hits AE for >24h the token can lapse silently and
 * the *first* customer-facing forward attempt fails. A daily cron keeps the
 * token green ahead of any order.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const db = getDb();
    const { rows } = await db.query<{ value: string }>(
      `SELECT value FROM platform_settings WHERE key = 'aliexpress_refresh_token' LIMIT 1`,
    );
    const refreshToken = rows[0]?.value?.trim();

    if (!refreshToken) {
      // 412 Precondition Failed: no refresh token persisted yet. Operator
      // must (re-)authorize via /api/aliexpress/oauth/start.
      return NextResponse.json(
        {
          ok: false,
          error: 'aliexpress_refresh_token missing — run /api/aliexpress/oauth/start first',
        },
        { status: 412 },
      );
    }

    const result = await refreshAccessTokenDetailed(refreshToken);
    if (!result.ok) {
      const err = new Error(`AE token refresh failed: ${result.error || 'unknown'}`);
      Sentry.captureException(err, {
        tags: { feature: 'ae_oauth_refresh', cron: 'qw7' },
        extra: { http_status: result.http_status, raw: result.raw },
      });
      return NextResponse.json(
        { ok: false, error: result.error || 'AliExpress refresh failed', http_status: result.http_status },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      expires_at: result.expires_at ?? null,
      rotated_refresh: result.rotated_refresh ?? false,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: 'ae_oauth_refresh', cron: 'qw7' } });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
