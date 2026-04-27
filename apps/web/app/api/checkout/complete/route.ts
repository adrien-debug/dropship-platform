import { NextRequest, NextResponse } from 'next/server';
import { getCartId, clearCartId } from '@/lib/cart-cookie';
import { completeCart, initPaymentSession } from '@/lib/medusa-store';
import { stripeEnabled, STRIPE_PROVIDER_ID } from '@/lib/stripe-env';

export async function POST(request: NextRequest) {
  try {
    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });

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
