import { createHash } from 'crypto';
import type { FunnelEvent } from './funnel';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Google Analytics 4 — Measurement Protocol (server-side).
 *
 * Mirror of the gtag client snippet for the same reason as Meta CAPI and
 * TikTok Events: 15-30% of client-side fires get killed by ad blockers,
 * iOS Safari ITP, or strict privacy extensions. The MP POST is sent
 * server-to-server, so it always lands.
 *
 * Dedup model: GA4 uses the `event_id` parameter inside `events[].params`
 * to merge a server-side event with its client-side twin — same UUID on
 * the gtag call and on this POST = counted once. We reuse the same
 * `event.eventId` already issued by `newEventId()` in `funnel.ts`, the
 * same one that's threaded into Meta CAPI and TikTok Events.
 *
 * No-op when `ga4MeasurementId` or `ga4ApiSecret` is absent on the store —
 * lets you ship the wiring and turn it on later from the admin form.
 */

const GA4_MP_URL = 'https://www.google-analytics.com/mp/collect';
const TIMEOUT_MS = 5000;

const GA4_EVENT_NAME: Record<FunnelEvent['eventName'], string> = {
  page_view: 'page_view',
  view_content: 'view_item',
  add_to_cart: 'add_to_cart',
  initiate_checkout: 'begin_checkout',
  purchase: 'purchase',
};

/** Item-level events get a populated `items` array — GA4 standard ecom shape. */
const EVENTS_WITH_ITEMS = new Set<FunnelEvent['eventName']>([
  'view_content',
  'add_to_cart',
  'initiate_checkout',
  'purchase',
]);

function sha256(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface Ga4Item {
  item_id: string;
  item_name?: string;
}

interface Ga4EventParams {
  event_id?: string;
  currency?: string;
  value?: number;
  items?: Ga4Item[];
  transaction_id?: string;
  page_location?: string;
  page_referrer?: string;
}

interface Ga4Payload {
  client_id: string;
  user_id?: string;
  events: Array<{ name: string; params: Ga4EventParams }>;
}

/**
 * Fire-and-forget. Errors are swallowed so a GA4 hiccup never blocks the
 * conversion flow on the storefront — console.error'd for Sentry.
 */
export async function sendGa4Conversion(
  store: Pick<StoreConfig, 'ga4MeasurementId' | 'ga4ApiSecret'>,
  event: FunnelEvent,
  opts?: { eventSourceUrl?: string },
): Promise<void> {
  if (!store.ga4MeasurementId || !store.ga4ApiSecret) return;

  const params: Ga4EventParams = {
    event_id: event.eventId,
    page_location: opts?.eventSourceUrl,
    page_referrer: event.referrer,
  };

  if (event.currencyCode) {
    params.currency = event.currencyCode.toUpperCase();
  }
  if (event.valueMinor != null) {
    params.value = event.valueMinor / 100;
  }

  if (EVENTS_WITH_ITEMS.has(event.eventName) && event.productId) {
    params.items = [
      {
        item_id: event.productId,
        // GA4 tolerates a missing `item_name`; we don't have it server-side
        // without an extra DB hit, so we ship just the id.
      },
    ];
  }

  if (event.eventName === 'purchase' && event.medusaOrderId) {
    params.transaction_id = event.medusaOrderId;
  }

  // user_id helps GA4 stitch cross-device when the visitor identifies
  // (email captured at checkout). SHA-256 keeps it RGPD-friendly.
  const userIdHash = sha256(event.email);

  const payload: Ga4Payload = {
    client_id: event.sessionId,
    user_id: userIdHash ?? undefined,
    events: [
      {
        name: GA4_EVENT_NAME[event.eventName],
        params,
      },
    ],
  };

  const url = `${GA4_MP_URL}?measurement_id=${encodeURIComponent(
    store.ga4MeasurementId,
  )}&api_secret=${encodeURIComponent(store.ga4ApiSecret)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    });
    // GA4 MP returns 204 No Content on success. Anything else is a
    // misconfiguration (bad measurement_id, bad api_secret, payload too
    // large) — log but never throw.
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[ga4-mp] ${res.status}: ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.error('[ga4-mp] network error', e);
  } finally {
    clearTimeout(timeout);
  }
}
