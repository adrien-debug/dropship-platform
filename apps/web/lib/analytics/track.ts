import { cookies } from 'next/headers';
import type { StoreConfig } from '@/lib/store-config';
import { CONSENT_COOKIE } from '@/lib/consent-shared';
import { logFunnelEvent, ensureSessionId, parseUtmCookie, newEventId, type FunnelEvent, type FunnelEventName } from './funnel';
import { sendMetaConversion } from './meta-capi';
import { sendTiktokConversion } from './tiktok-events';
import { sendGa4Conversion } from './ga4-mp';
import { clientIp } from '@/lib/rate-limit';

/**
 * One-call composer used by route handlers. Resolves session/UTM/consent
 * from the request cookies, writes the event to `dropship_funnel_events`,
 * and (in parallel) forwards to Meta CAPI + TikTok Events API + GA4
 * Measurement Protocol.
 *
 * Consent gate: nothing is logged or forwarded unless the visitor's
 * `consent_analytics` cookie is `granted`. We track once, properly.
 *
 * Errors are swallowed — analytics must never break a checkout.
 */

const SESSION_COOKIE = 'session_id';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface TrackInput {
  store: StoreConfig;
  request: Request;
  eventName: FunnelEventName;
  productId?: string;
  variantId?: string;
  valueMinor?: number;
  currencyCode?: string;
  email?: string;
  phone?: string;
  medusaOrderId?: string;
  /** Already-allocated UUID for client/server dedup. Generate one if you also need to send to the client pixel. */
  eventId?: string;
}

export async function trackEvent(input: TrackInput): Promise<{ eventId: string | null }> {
  try {
    const cookieJar = await cookies();
    const consent = cookieJar.get(CONSENT_COOKIE)?.value;
    if (consent !== 'granted') {
      // No tracking without explicit opt-in. Funnel/CAPI/Events all skipped.
      return { eventId: null };
    }

    const utm = parseUtmCookie(cookieJar.get('utm_attribution')?.value);
    const session = ensureSessionId(cookieJar.get(SESSION_COOKIE)?.value);
    if (session.isNew) {
      cookieJar.set(SESSION_COOKIE, session.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_SECONDS,
        path: '/',
      });
    }

    const event: FunnelEvent = {
      storeSlug: input.store.slug,
      sessionId: session.id,
      eventName: input.eventName,
      eventId: input.eventId ?? newEventId(),
      productId: input.productId,
      variantId: input.variantId,
      valueMinor: input.valueMinor,
      currencyCode: input.currencyCode,
      attribution: utm,
      referrer: input.request.headers.get('referer') ?? undefined,
      userAgent: input.request.headers.get('user-agent') ?? undefined,
      ip: clientIp(input.request),
      email: input.email,
      phone: input.phone,
      medusaOrderId: input.medusaOrderId,
    };

    const sourceUrl = input.request.headers.get('referer') ?? undefined;

    const labels = ['funnel', 'meta-capi', 'tiktok-events', 'ga4-mp'];
    const results = await Promise.allSettled([
      logFunnelEvent(event),
      sendMetaConversion(input.store, event, { eventSourceUrl: sourceUrl }),
      sendTiktokConversion(input.store, event, { eventSourceUrl: sourceUrl }),
      sendGa4Conversion(input.store, event, { eventSourceUrl: sourceUrl }),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[trackEvent] ${labels[i]} failed`, r.reason);
    });

    return { eventId: event.eventId ?? null };
  } catch (e) {
    console.error('[trackEvent] swallowed', e);
    return { eventId: null };
  }
}
