/**
 * Client-side pixel dedup helper.
 *
 * Meta Pixel and TikTok Pixel both accept an `eventID` parameter that pairs
 * the client-side fire with the server-side CAPI / Events API fire. When
 * both arrive with the same `eventID`, Meta and TikTok dedup them into a
 * single conversion — the canonical pattern for iOS / ad-blocker resilience.
 *
 * Without dedup, the server-side fire and the auto-fire from the pixel
 * snippet count as two distinct events, over-inflating ROAS by 30 to 60%.
 *
 * The Meta and TikTok snippets define `fbq` / `ttq` immediately on window
 * (with their own internal queue), so calling them before the SDK script
 * finishes loading is safe — the call is queued and replayed on load.
 */

type ClientEventName =
  | 'page_view'
  | 'view_content'
  | 'add_to_cart'
  | 'initiate_checkout'
  | 'purchase';

const META_EVENT_MAP: Record<ClientEventName, string> = {
  page_view: 'PageView',
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
};

const TIKTOK_EVENT_MAP: Record<ClientEventName, string> = {
  page_view: 'Pageview',
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'CompletePayment',
};

interface PixelEventParams {
  /** Money amount in major units (e.g. 19.99 for €19.99). */
  value?: number;
  /** ISO 4217 (uppercase). */
  currency?: string;
  /** Product identifiers — Meta `content_ids`, TikTok `content_id`. */
  contentIds?: string[];
  /** Free-form content name (product title). */
  contentName?: string;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void;
      page: (params?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Fire client-side pixel events with a shared eventID for server dedup.
 * No-op when not in a browser, when pixels aren't installed, or when
 * `eventId` is missing (we don't want to fire un-deduped events that
 * inflate the server fire).
 */
export function firePixels(
  eventName: ClientEventName,
  params: PixelEventParams = {},
  eventId: string | null,
): void {
  if (typeof window === 'undefined') return;
  if (!eventId) return;

  const metaParams: Record<string, unknown> = {};
  const tiktokParams: Record<string, unknown> = {};
  if (params.value !== undefined && params.currency) {
    metaParams.value = params.value;
    metaParams.currency = params.currency.toUpperCase();
    tiktokParams.value = params.value;
    tiktokParams.currency = params.currency.toUpperCase();
  }
  if (params.contentIds?.length) {
    metaParams.content_ids = params.contentIds;
    metaParams.content_type = 'product';
    tiktokParams.content_id = params.contentIds[0];
    tiktokParams.content_type = 'product';
  }
  if (params.contentName) {
    metaParams.content_name = params.contentName;
    tiktokParams.content_name = params.contentName;
  }

  // Meta Pixel — eventID dedup partner of Meta Conversions API.
  if (typeof window.fbq === 'function') {
    try {
      window.fbq('track', META_EVENT_MAP[eventName], metaParams, { eventID: eventId });
    } catch {
      // Pixel never breaks the page.
    }
  }

  // TikTok Pixel — event_id dedup partner of TikTok Events API.
  if (window.ttq && typeof window.ttq.track === 'function') {
    try {
      window.ttq.track(TIKTOK_EVENT_MAP[eventName], tiktokParams, { event_id: eventId });
    } catch {
      // ditto
    }
  }
}
