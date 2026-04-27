import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe-env';

export const runtime = 'nodejs';

/**
 * Stub webhook receiver. Payment capture and order finalization are handled by
 * the Medusa backend's own Stripe webhook — this route only verifies the
 * signature so Stripe gets a clean 200 if it's configured to also call us.
 */
export async function POST(request: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true, ignored: 'stripe not configured' });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const body = await request.text();
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'invalid' }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
