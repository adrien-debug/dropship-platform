import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe-env';

export const runtime = 'nodejs';

/**
 * Receives Stripe events; the heavy lifting (capturing payments, finalizing carts)
 * is handled by the Medusa backend's own Stripe webhook. This route is a Next-side
 * convenience hook for analytics/notifications.
 */
export async function POST(request: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true, ignored: 'stripe not configured' });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const body = await request.text();
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'invalid' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('[Stripe] payment_intent.succeeded', event.data.object.id);
      break;
    case 'payment_intent.payment_failed':
      console.log('[Stripe] payment_intent.payment_failed', event.data.object.id);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
