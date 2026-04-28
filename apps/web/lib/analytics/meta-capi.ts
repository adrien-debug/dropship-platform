import { createHash } from 'crypto';
import type { FunnelEvent } from './funnel';
import type { StoreConfig } from '@/lib/store-config';

/**
 * Meta Conversions API client. Server-side mirror of the browser pixel —
 * the same conversion arrives both via fbq() in the client AND via this
 * POST. Meta dedups the two using `event_id`, so client + server have to
 * agree on the same UUID for the same conversion.
 *
 * Why bother with server-side: ad blockers strip the client pixel for
 * 30-50% of EU traffic. Without CAPI, you're losing that signal and Meta
 * can't optimise the campaign. With CAPI, attribution holds up.
 *
 * No-op when `metaCapiToken` or `metaPixelId` is missing on the store —
 * lets you ship the wiring without a token and turn it on later from
 * the admin form.
 */

const META_CAPI_URL = 'https://graph.facebook.com/v21.0';

const META_EVENT_NAME: Record<FunnelEvent['eventName'], string> = {
  page_view: 'PageView',
  view_content: 'ViewContent',
  add_to_cart: 'AddToCart',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
};

function sha256(value: string | undefined | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface MetaCapiPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id?: string;
    action_source: 'website';
    event_source_url?: string;
    user_data: Record<string, string | string[] | undefined>;
    custom_data?: Record<string, unknown>;
  }>;
}

/**
 * Fire-and-forget. Errors are swallowed so a Meta hiccup never blocks
 * the conversion flow on the storefront — they're console.error'd for
 * Sentry to pick up on the server.
 */
export async function sendMetaConversion(
  store: Pick<StoreConfig, 'metaPixelId' | 'metaCapiToken'>,
  event: FunnelEvent,
  opts?: { eventSourceUrl?: string },
): Promise<void> {
  if (!store.metaPixelId || !store.metaCapiToken) return;

  const payload: MetaCapiPayload = {
    data: [
      {
        event_name: META_EVENT_NAME[event.eventName],
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: 'website',
        event_source_url: opts?.eventSourceUrl,
        user_data: {
          em: sha256(event.email) ?? undefined,
          ph: sha256(event.phone) ?? undefined,
          client_ip_address: event.ip,
          client_user_agent: event.userAgent,
          fbc: event.attribution?.fbclid
            ? `fb.1.${Math.floor(Date.now() / 1000)}.${event.attribution.fbclid}`
            : undefined,
          fbp: undefined, // Set client-side by the pixel; we don't see it here.
        },
        custom_data: event.eventName === 'purchase' || event.eventName === 'add_to_cart' || event.eventName === 'initiate_checkout'
          ? {
              currency: event.currencyCode?.toUpperCase(),
              value: event.valueMinor != null ? event.valueMinor / 100 : undefined,
              content_ids: event.productId ? [event.productId] : undefined,
              content_type: 'product',
              order_id: event.medusaOrderId,
            }
          : undefined,
      },
    ],
  };

  try {
    const url = `${META_CAPI_URL}/${store.metaPixelId}/events?access_token=${encodeURIComponent(store.metaCapiToken)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[meta-capi] ${res.status}: ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.error('[meta-capi] network error', e);
  }
}
