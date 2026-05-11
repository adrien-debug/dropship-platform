'use client';

import { useEffect, useRef } from 'react';
import type { FunnelEventName } from '@/lib/analytics/funnel';

/**
 * Client-side fire-and-forget event tracker. Mounts on a storefront page and
 * POSTs to /api/analytics/track once on mount. The endpoint handles consent
 * gating (denied/missing cookie returns a 200 no-op) and forwards to Meta CAPI
 * + TikTok Events API server-side.
 *
 * Pixel-side automatic page_view from fbq/ttq still fires from
 * StoreAnalytics; this server-side fire is the dedup partner that gives us
 * iOS / ad-blocker resilience on attribution.
 *
 * We use a ref to guard against the StrictMode double-effect in dev, so the
 * event lands exactly once per real navigation.
 */
export function TrackPageView({
  slug,
  eventName,
  productId,
  variantId,
}: {
  slug: string;
  eventName: Extract<FunnelEventName, 'page_view' | 'view_content'>;
  productId?: string;
  variantId?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const controller = new AbortController();
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, eventName, productId, variantId }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      // analytics never breaks the page
    });

    return () => controller.abort();
  }, [slug, eventName, productId, variantId]);

  return null;
}
