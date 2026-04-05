import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'] ?? '';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3100';

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET);

  try {
    const body = (await req.json()) as {
      items: Array<{
        name: string;
        unitPrice: number;
        quantity: number;
        imageUrl?: string;
      }>;
      shippingCents: number;
      promoCode?: string;
    };

    if (!body.items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = body.items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
        },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.quantity,
    }));

    if (body.shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Livraison' },
          unit_amount: body.shippingCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart`,
      shipping_address_collection: { allowed_countries: ['FR', 'BE', 'CH', 'DE', 'ES', 'IT', 'NL', 'PT', 'GB', 'US'] },
      ...(body.promoCode ? { metadata: { promo_code: body.promoCode } } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Payment session creation failed' }, { status: 500 });
  }
}
