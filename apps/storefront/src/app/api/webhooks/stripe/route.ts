import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'] ?? '';
const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET);
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[stripe-webhook] Supabase not configured, cannot update order');
      return NextResponse.json({ received: true });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { error } = await supabase
        .from('clawd_crm_orders')
        .update({ status: 'paid' })
        .eq('external_ref', session.id);

      if (error) {
        console.error('[stripe-webhook] Order update failed:', error.message);
      }
    } catch (err) {
      console.error('[stripe-webhook] Unexpected error updating order:', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true });
}
