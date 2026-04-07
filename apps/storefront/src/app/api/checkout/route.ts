import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { verifyOnepeaceSessionToken } from '@/lib/session-jwt';
import { getSiteId } from '@/lib/site-config';

const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'] ?? '';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3100';
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

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

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const amountTotal = body.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        ) + (body.shippingCents > 0 ? body.shippingCents / 100 : 0);

        const siteId = await getSiteId();

        let customerId: string | null = null;
        const authHeader = req.headers.get('authorization');
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim()
          : req.cookies.get('shop_token')?.value ?? '';
        if (bearer) {
          const payload = await verifyOnepeaceSessionToken(bearer);
          if (payload) customerId = payload.sub;
        }

        await supabase.from('clawd_crm_orders').insert({
          amount_total: amountTotal,
          currency: 'EUR',
          status: 'pending',
          external_ref: session.id,
          placed_at: new Date().toISOString(),
          ...(customerId ? { customer_id: customerId } : {}),
          ...(siteId ? { site_id: siteId } : {}),
        });
      } catch (orderErr) {
        console.error('[checkout] Order record creation failed:', orderErr instanceof Error ? orderErr.message : orderErr);
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Payment session creation failed' }, { status: 500 });
  }
}
