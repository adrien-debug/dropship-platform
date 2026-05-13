'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { firePixels } from '@/lib/analytics/pixel-client';

interface StripePaymentProps {
  publishableKey: string;
  amountLabel: string;
}

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(key: string) {
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

export function StripePayment({ publishableKey, amountLabel }: StripePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/checkout/payment', { method: 'POST' })
      .then(async (r) => {
        const j = (await r.json()) as {
          success?: boolean;
          error?: string;
          clientSecret?: string;
          amount?: number;
          currency?: string;
          eventId?: string | null;
        };
        if (cancelled) return;
        if (!r.ok || !j.success) throw new Error(j.error || 'Erreur init paiement');
        setClientSecret(j.clientSecret ?? null);
        // Pair the server-side InitiateCheckout fire with a client pixel
        // call carrying the same eventID for Meta and TikTok dedup.
        if (j.eventId) {
          firePixels(
            'initiate_checkout',
            {
              value: j.amount !== undefined ? j.amount / 100 : undefined,
              currency: j.currency,
            },
            j.eventId,
          );
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erreur'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!clientSecret) return <p className="text-zinc-500 text-sm">Initialisation du paiement…</p>;

  return (
    <Elements
      stripe={getStripePromise(publishableKey)}
      options={{ clientSecret, appearance: { theme: 'stripe' } }}
    >
      <StripePayForm amountLabel={amountLabel} />
    </Elements>
  );
}

function StripePayForm({ amountLabel }: { amountLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function pay() {
    if (!stripe || !elements) return;
    setError(null);
    startTransition(async () => {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.origin + '/checkout?return=1' },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message ?? 'Erreur paiement');
        return;
      }
      const res = await apiFetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipPaymentInit: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Erreur finalisation');
        return;
      }
      if (data.orderId) router.push(`/order/${data.orderId}`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="button"
        onClick={pay}
        disabled={pending || !stripe || !elements}
        className="bg-black text-white px-6 py-3 rounded-md hover:bg-zinc-800 disabled:opacity-60 w-full"
      >
        {pending ? 'Paiement…' : `Payer ${amountLabel}`}
      </button>
    </div>
  );
}
