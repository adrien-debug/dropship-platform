import { NextRequest, NextResponse } from 'next/server';
import { getCartId } from '@/lib/cart-cookie';
import { getCart, storeFetch } from '@/lib/medusa-store';
import { STRIPE_PROVIDER_ID, stripeEnabled } from '@/lib/stripe-env';
import { enforceRateLimit } from '@/lib/rate-limit';

interface PaymentSession {
  id: string;
  provider_id: string;
  data?: Record<string, unknown> & { client_secret?: string };
  status?: string;
}
interface PaymentCollection {
  id: string;
  payment_sessions?: PaymentSession[];
}

/**
 * Initializes a Stripe payment session against Medusa.
 * Returns the Stripe `client_secret` consumed by `<PaymentElement />`.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-payment', { max: 10, windowSec: 60 });
    if (limited) return limited;
    if (!stripeEnabled()) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 });
    }
    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });

    const { cart } = await getCart(cartId);

    const created = await storeFetch<{ payment_collection: PaymentCollection }>(`/store/payment-collections`, {
      method: 'POST',
      body: JSON.stringify({ cart_id: cartId }),
    });
    const session = await storeFetch<{ payment_collection: PaymentCollection }>(
      `/store/payment-collections/${created.payment_collection.id}/payment-sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ provider_id: STRIPE_PROVIDER_ID }),
      },
    );
    const stripeSession = session.payment_collection.payment_sessions?.find((s) => s.provider_id === STRIPE_PROVIDER_ID);
    const clientSecret = stripeSession?.data?.client_secret;
    if (!clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe session sans client_secret',
          hint: 'Vérifier que le module @medusajs/payment-stripe est installé sur Medusa et que STRIPE_API_KEY est défini côté backend Medusa.',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      clientSecret,
      paymentCollectionId: created.payment_collection.id,
      amount: cart.total,
      currency: cart.currency_code,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
