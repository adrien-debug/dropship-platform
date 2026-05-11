import { createHash } from 'crypto';
import type { FunnelEvent } from './funnel';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Google Ads Click Conversions API v18 — server-side upload.
 *
 * Uses the offline Click Conversions endpoint so purchase signals from
 * server-side checkout land in Google Ads even when the gtag client pixel
 * is blocked. Enhanced Conversions data (hashed email / phone) improves
 * match rates when gclid is absent (e.g. direct traffic, dark social).
 *
 * Auth: OAuth2 refresh-token flow. Tokens are cached in module-level state
 * for their 1-hour TTL so we only hit the token endpoint once per cold-start,
 * not on every conversion.
 *
 * No-op when:
 *   - store.googleAdsConversionAction is not set
 *   - required env vars (GOOGLE_ADS_DEVELOPER_TOKEN / CLIENT_ID / REFRESH_TOKEN) are absent
 *   - event is not a purchase
 *   - no matchable signal (no gclid AND no email AND no phone)
 *
 * Errors are swallowed — analytics must never break checkout.
 */

const GOOGLE_ADS_API_VERSION = 'v18';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 5000;

function sha256(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

// ── In-memory token cache ────────────────────────────────────────────────────
// Safe for a single Vercel function instance; on cold-starts the token is
// re-fetched once. No persistence needed: tokens last ~1 h and any instance
// reset triggers a fresh fetch.

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let _cachedToken: CachedToken | null = null;

/** Exchange refresh token for a short-lived access token. Cached for TTL. */
async function getAccessToken(signal: AbortSignal): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 30_000) {
    // 30 s buffer before expiry
    return _cachedToken.accessToken;
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN!;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[google-ads] token exchange failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  _cachedToken = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return _cachedToken.accessToken;
}

/** Exposed for testing only — resets the module-level token cache. */
export function _resetTokenCache(): void {
  _cachedToken = null;
}

/** Exposed for testing only — inject a fake cached token. */
export function _injectCachedToken(token: CachedToken): void {
  _cachedToken = token;
}

// ── Conversion DateTime helper ───────────────────────────────────────────────
// Google Ads requires "yyyy-MM-dd HH:mm:ss+HH:MM" format, not ISO-8601.
function toGoogleAdsDateTime(date: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}-` +
    `${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())}+00:00`
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function sendGoogleAdsConversion(
  store: Pick<StoreConfig, 'googleAdsConversionAction' | 'googleAdsMerchantId'>,
  event: FunnelEvent,
  _opts?: { eventSourceUrl?: string },
): Promise<void> {
  // Guard: store must have a conversion action configured.
  if (!store.googleAdsConversionAction) return;

  // Guard: required env vars.
  if (
    !process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
    !process.env.GOOGLE_ADS_CLIENT_ID ||
    !process.env.GOOGLE_ADS_REFRESH_TOKEN
  ) {
    return;
  }

  // Guard: purchase events only.
  if (event.eventName !== 'purchase') return;

  // Guard: must have at least one matchable signal.
  const gclid = event.gclid;
  const hasEmail = Boolean(event.email);
  const hasPhone = Boolean(event.phone);
  if (!gclid && !hasEmail && !hasPhone) return;

  const customerId =
    process.env.GOOGLE_ADS_CUSTOMER_ID ?? '2877134493';

  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const accessToken = await getAccessToken(controller.signal);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    };

    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    }

    const conversion: Record<string, unknown> = {
      conversionAction: store.googleAdsConversionAction,
      conversionDateTime: toGoogleAdsDateTime(),
      conversionValue:
        event.valueMinor != null ? event.valueMinor / 100 : undefined,
      currencyCode: (event.currencyCode ?? 'EUR').toUpperCase(),
      orderId: event.medusaOrderId ?? undefined,
    };

    if (gclid) {
      conversion.gclid = gclid;
    }

    const hashedEmail = sha256(event.email);
    if (hashedEmail) {
      conversion.hashedEmail = hashedEmail;
    }

    const hashedPhone = sha256(event.phone);
    if (hashedPhone) {
      conversion.hashedPhoneNumber = hashedPhone;
    }

    const payload = {
      conversions: [conversion],
      partialFailure: true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[google-ads] ${res.status}: ${body.slice(0, 300)}`);
      return;
    }

    // Partial failure: log individual conversion errors but don't throw.
    const json = (await res.json().catch(() => null)) as {
      partialFailureError?: unknown;
    } | null;
    if (json?.partialFailureError) {
      console.error('[google-ads] partialFailureError', JSON.stringify(json.partialFailureError).slice(0, 300));
    }
  } catch (e) {
    console.error('[google-ads] error', e);
  } finally {
    clearTimeout(timeout);
  }
}
