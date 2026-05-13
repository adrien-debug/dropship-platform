'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useEffect, useRef } from 'react';
import type { FunnelEventName } from '@/lib/analytics/funnel';
import { firePixels } from '@/lib/analytics/pixel-client';

/**
 * Client-side event tracker that double-dedups the page view / view content.
 *
 * Flow on mount:
 *   1. POST to /api/analytics/track — server logs the funnel event, hashes
 *      PII, forwards to Meta CAPI + TikTok Events API in parallel, returns
 *      the canonical `eventId`.
 *   2. Fire fbq('track', 'PageView'|'ViewContent', params, {eventID}) and
 *      the TikTok pixel equivalent with the same id. Meta and TikTok dedup
 *      the server fire and the client fire into a single conversion.
 *
 * The pixel auto-fire was deliberately removed from StoreAnalytics so this
 * is now the single source for page-level pixel events — no un-deduped
 * datapoints inflate ROAS.
 *
 * StrictMode safety: the `sent` ref guards against the dev double-effect so
 * we land exactly one event per real navigation.
 */
export function TrackPageView({
  slug,
  eventName,
  productId,
  variantId,
  productTitle,
  valueMinor,
  currencyCode,
}: {
  slug: string;
  eventName: Extract<FunnelEventName, 'page_view' | 'view_content'>;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  /** Money amount in minor units (cents). Optional. */
  valueMinor?: number;
  currencyCode?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await apiFetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug, eventName, productId, variantId }),
          keepalive: true,
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as { eventId?: string | null } | null;
        const eventId = data?.eventId ?? null;
        if (!eventId) return; // consent denied or endpoint no-op — don't fire pixels either

        firePixels(
          eventName,
          {
            value: valueMinor !== undefined ? valueMinor / 100 : undefined,
            currency: currencyCode,
            contentIds: productId ? [productId] : undefined,
            contentName: productTitle,
          },
          eventId,
        );
      } catch {
        // analytics never breaks the page
      }
    })();

    return () => controller.abort();
  }, [slug, eventName, productId, variantId, productTitle, valueMinor, currencyCode]);

  return null;
}
