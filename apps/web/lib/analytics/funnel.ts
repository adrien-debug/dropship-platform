import { createHash, randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Funnel events storage + RGPD-friendly PII hashing.
 *
 * Every conversion event a visitor triggers (AddToCart, InitiateCheckout,
 * Purchase) is persisted server-side in `dropship_funnel_events`. We
 * hash anything that could identify the visitor (IP, email, phone) with
 * SHA-256 — Meta and TikTok both accept the hashed form for matching,
 * and we keep the raw values out of the DB so subject-access requests
 * stay simple ("we never stored your email in clear").
 */

export type FunnelEventName =
  | 'page_view'
  | 'view_content'
  | 'add_to_cart'
  | 'initiate_checkout'
  | 'purchase';

interface UtmAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
  captured_at?: string;
}

export interface FunnelEvent {
  storeSlug: string;
  sessionId: string;
  eventName: FunnelEventName;
  /** Stable UUID v4 used to dedup the same conversion across client pixel + server CAPI. */
  eventId?: string;
  productId?: string;
  variantId?: string;
  valueMinor?: number;
  currencyCode?: string;
  attribution?: UtmAttribution;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  email?: string;
  phone?: string;
  medusaOrderId?: string;
  /** Google Click ID — present when visitor arrived via a Google Ads click. */
  gclid?: string;
}

/** Lower-case + trim before hashing — Meta's match algo expects normalised input. */
function sha256(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function newEventId(): string {
  return randomUUID();
}

/**
 * Parse the utm_attribution cookie value (URL-decoded JSON). Tolerant —
 * an unparseable cookie returns an empty object, never throws.
 */
export function parseUtmCookie(raw: string | undefined): UtmAttribution {
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw)) as UtmAttribution;
  } catch {
    return {};
  }
}

export async function logFunnelEvent(event: FunnelEvent): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO dropship_funnel_events (
       store_slug, session_id, event_name, event_id,
       product_id, variant_id, value_minor, currency_code,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       fbclid, ttclid, referrer, user_agent,
       ip_hash, email_hash, phone_hash, medusa_order_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [
      event.storeSlug,
      event.sessionId,
      event.eventName,
      event.eventId ?? null,
      event.productId ?? null,
      event.variantId ?? null,
      event.valueMinor ?? null,
      event.currencyCode ?? null,
      event.attribution?.utm_source ?? null,
      event.attribution?.utm_medium ?? null,
      event.attribution?.utm_campaign ?? null,
      event.attribution?.utm_term ?? null,
      event.attribution?.utm_content ?? null,
      event.attribution?.fbclid ?? null,
      event.attribution?.ttclid ?? null,
      event.referrer ?? null,
      event.userAgent ?? null,
      sha256(event.ip),
      sha256(event.email),
      sha256(event.phone),
      event.medusaOrderId ?? null,
    ],
  );
}

/**
 * Stable session id read from the visitor's `session_id` cookie if set,
 * otherwise generated. The route handler is responsible for setting the
 * cookie back on the response — this helper just resolves a value to use
 * for the current event.
 */
export function ensureSessionId(cookieValue: string | undefined): { id: string; isNew: boolean } {
  if (cookieValue && /^[a-z0-9-]{16,64}$/i.test(cookieValue)) {
    return { id: cookieValue, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

/**
 * Bag of params commonly threaded through cart/checkout routes — keeps
 * the wiring concise.
 */
interface FunnelContext {
  store: StoreConfig;
  sessionId: string;
  attribution: UtmAttribution;
  ip?: string;
  userAgent?: string;
  referrer?: string;
}
