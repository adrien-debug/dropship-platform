import { createHash } from 'crypto';
import type { FunnelEvent } from './funnel';
import type { StoreConfig } from '@/lib/store-config';

/**
 * TikTok Events API (v1.3) — the server-side mirror of the TikTok pixel.
 * Same dedup model as Meta CAPI: same event_id on client + server, TikTok
 * counts the conversion once.
 *
 * No-op when `tiktokEventsToken` or `tiktokPixelId` is missing.
 */

const TIKTOK_EVENTS_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

const TIKTOK_EVENT_NAME: Record<FunnelEvent['eventName'], string> = {
  page_view: 'Pageview',
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'CompletePayment',
};

function sha256(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface TikTokPayload {
  event_source: 'web';
  event_source_id: string;
  data: Array<{
    event: string;
    event_time: number;
    event_id?: string;
    user: Record<string, string | undefined>;
    properties?: Record<string, unknown>;
    page?: { url?: string; referrer?: string };
  }>;
}

export async function sendTiktokConversion(
  store: Pick<StoreConfig, 'tiktokPixelId' | 'tiktokEventsToken'>,
  event: FunnelEvent,
  opts?: { eventSourceUrl?: string },
): Promise<void> {
  if (!store.tiktokPixelId || !store.tiktokEventsToken) return;

  const payload: TikTokPayload = {
    event_source: 'web',
    event_source_id: store.tiktokPixelId,
    data: [
      {
        event: TIKTOK_EVENT_NAME[event.eventName],
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        user: {
          email: sha256(event.email) ?? undefined,
          phone: sha256(event.phone) ?? undefined,
          ip: event.ip,
          user_agent: event.userAgent,
          ttclid: event.attribution?.ttclid,
        },
        properties: event.eventName === 'purchase' || event.eventName === 'add_to_cart' || event.eventName === 'initiate_checkout'
          ? {
              currency: event.currencyCode?.toUpperCase(),
              value: event.valueMinor != null ? event.valueMinor / 100 : undefined,
              content_id: event.productId,
              content_type: 'product',
              order_id: event.medusaOrderId,
            }
          : undefined,
        page: {
          url: opts?.eventSourceUrl,
          referrer: event.referrer,
        },
      },
    ],
  };

  try {
    const res = await fetch(TIKTOK_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': store.tiktokEventsToken,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[tiktok-events] ${res.status}: ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.error('[tiktok-events] network error', e);
  }
}
