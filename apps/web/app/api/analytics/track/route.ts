import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStoreBySlug } from '@/lib/store-config';
import { trackEvent } from '@/lib/analytics/track';
import type { FunnelEventName } from '@/lib/analytics/funnel';

const EVENT_NAMES: readonly FunnelEventName[] = [
  'page_view',
  'view_content',
] as const;

const Body = z.object({
  slug: z.string().min(1).max(80),
  eventName: z.enum(['page_view', 'view_content']),
  productId: z.string().max(64).optional(),
  variantId: z.string().max(64).optional(),
  eventId: z.string().uuid().optional(),
});

/**
 * Storefront "soft" event tracker. Fires page_view and view_content from the
 * client on mount so we don't need to write the session cookie from a Server
 * Component (writes are only allowed in actions / handlers / middleware).
 *
 * Cart / checkout events stay on their dedicated routes — they carry real
 * domain payload and need stricter validation.
 *
 * Consent is checked inside trackEvent: a denied / missing cookie returns
 * `{ eventId: null }` without writing anything.
 */
export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  if (!EVENT_NAMES.includes(parsed.eventName)) {
    return NextResponse.json({ ok: false, error: 'unsupported_event' }, { status: 400 });
  }

  const store = await getStoreBySlug(parsed.slug);
  if (!store) {
    return NextResponse.json({ ok: false, error: 'store_not_found' }, { status: 404 });
  }

  const { eventId } = await trackEvent({
    store,
    request: req,
    eventName: parsed.eventName,
    productId: parsed.productId,
    variantId: parsed.variantId,
    eventId: parsed.eventId,
  });

  return NextResponse.json({ ok: true, eventId });
}
