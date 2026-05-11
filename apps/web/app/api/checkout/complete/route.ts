import { NextRequest, NextResponse } from 'next/server';
import { getCartId, clearCartId, getLastStoreSlug } from '@/lib/cart-cookie';
import { completeCart, initPaymentSession } from '@/lib/medusa-store';
import { medusa } from '@/lib/medusa';
import { stripeEnabled, STRIPE_PROVIDER_ID } from '@/lib/stripe-env';
import { checkRateLimit, enforceRateLimit } from '@/lib/rate-limit';
import { getStoreBySlug } from '@/lib/store-config';
import { trackEvent } from '@/lib/analytics/track';

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-complete', { max: 5, windowSec: 60 });
    if (limited) return limited;

    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });

    // Per-cart idempotency lock: a double-click on the Pay button (or a
    // browser-level retry on a flaky network) must not double-fire the
    // completeCart + capturePayments flow before captured_at is written.
    // 1 request per 10 s per cart is plenty for the user; replays beyond
    // that get a 429 instead of a possibly-double-charged order.
    const cartLock = await checkRateLimit(`checkout-complete-cart:${cartId}`, { max: 1, windowSec: 10 }).catch(
      () => ({ ok: true } as { ok: boolean }),
    );
    if (!cartLock.ok) {
      return NextResponse.json(
        { success: false, error: 'Commande déjà en cours de validation, patientez un instant.' },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const skipPaymentInit = body?.skipPaymentInit === true;

    if (!skipPaymentInit) {
      const provider = stripeEnabled() ? STRIPE_PROVIDER_ID : 'pp_system_default';
      try {
        await initPaymentSession(cartId, provider);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        return NextResponse.json(
          {
            success: false,
            error: `Paiement indisponible : ${msg}`,
            hint: stripeEnabled()
              ? "Vérifier que le module @medusajs/payment-stripe est installé sur Medusa et activé sur la région."
              : "Aucun provider de paiement actif. Activer pp_system_default sur la région Medusa via /api/medusa/setup.",
          },
          { status: 503 },
        );
      }
    }

    const result = await completeCart(cartId);
    if (result.type === 'order' && result.order) {
      await clearCartId();

      // Auto-capture: dropship business needs funds in-hand to forward to AE.
      // Best-effort: a capture failure (already captured, network blip) must
      // not roll back an otherwise-valid order. The merchant can retry from
      // /admin/orders if needed.
      //
      // Per-order capture lock: prevents two concurrent completeCart calls
      // (Medusa returns the same order for both) from both racing past the
      // captured_at=null check inside capturePayments and double-charging.
      const captureLock = await checkRateLimit(`capture:${result.order.id}`, { max: 1, windowSec: 30 }).catch(
        () => ({ ok: true } as { ok: boolean }),
      );
      if (captureLock.ok) {
        try {
          await medusa.capturePayments(result.order.id);
        } catch (err) {
          console.error(`[checkout/complete] capture failed for ${result.order.id}:`, err);
        }
      }

      // Purchase conversion — fire AFTER capture so we only count
      // money-in-hand. Fetch the full order for email/total/currency;
      // a fetch failure is non-fatal, the order is already created.
      //
      // QW3 wiring: trackEvent persists a `purchase` row in
      // dropship_funnel_events with the visitor's session_id, event_id,
      // utm_* and medusa_order_id all in one shot. That row is the join
      // key used later by order-forwarder.ts → loadAttributionForOrder()
      // to hydrate attribution_json / session_id / event_id on the
      // dropship_order_forwards INSERT. No additional UPDATE needed.
      const slug = await getLastStoreSlug();
      if (slug) {
        const store = await getStoreBySlug(slug).catch(() => null);
        const fullOrder = await medusa.getOrder(result.order.id).catch(() => null);
        if (store && fullOrder) {
          const { eventId } = await trackEvent({
            store,
            request,
            eventName: 'purchase',
            valueMinor: typeof fullOrder.total === 'number' ? Math.round(fullOrder.total * 100) : undefined,
            currencyCode: fullOrder.currency_code,
            email: fullOrder.email ?? undefined,
            phone: fullOrder.shipping_address?.phone ?? undefined,
            medusaOrderId: result.order.id,
          });
          if (eventId) {
            console.log(`[checkout/complete] purchase tracked order=${result.order.id} event=${eventId}`);
          }
        }
      }

      return NextResponse.json({ success: true, orderId: result.order.id, displayId: result.order.display_id });
    }

    return NextResponse.json(
      { success: false, error: 'Cart not converted to order', detail: result.cart ? 'cart returned' : 'unknown' },
      { status: 500 },
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
