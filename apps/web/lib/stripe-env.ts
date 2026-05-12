/**
 * Stripe runtime config. Server-side helper exposes whether Stripe is wired up
 * end-to-end (publishable + secret + Medusa region). Client uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY only.
 */
const STRIPE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
export const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();

export function stripeEnabled(): boolean {
  return !!STRIPE_PUBLISHABLE_KEY && !!STRIPE_SECRET_KEY;
}

export const STRIPE_PROVIDER_ID = 'pp_stripe_stripe';
