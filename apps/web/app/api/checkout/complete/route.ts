import { NextResponse } from 'next/server';
import { getCartId, clearCartId } from '@/lib/cart-cookie';
import { completeCart, initPaymentSession } from '@/lib/medusa-store';

export async function POST() {
  try {
    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });

    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY?.trim();
    const provider = stripeConfigured ? 'pp_stripe_stripe' : 'pp_system_default';

    try {
      await initPaymentSession(cartId, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      return NextResponse.json(
        {
          success: false,
          error: `Paiement indisponible : ${msg}`,
          hint: stripeConfigured
            ? "Vérifier que le module Stripe est installé sur Medusa et activé sur la région."
            : "Aucun provider de paiement actif. Configurer Stripe (STRIPE_SECRET_KEY + plugin Medusa) ou activer pp_system_default sur la région Medusa.",
        },
        { status: 503 },
      );
    }

    const result = await completeCart(cartId);
    if (result.type === 'order' && result.order) {
      await clearCartId();
      return NextResponse.json({ success: true, orderId: result.order.id, displayId: result.order.display_id });
    }

    return NextResponse.json({ success: false, error: 'Cart not converted to order', detail: result.cart ? 'cart returned' : 'unknown' }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
