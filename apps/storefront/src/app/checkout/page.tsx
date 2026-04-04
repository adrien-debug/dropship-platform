'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCart } from '@/lib/cart-context';
import {
  updateCartEmail,
  addShippingAddress,
  getShippingOptions,
  addShippingMethod,
  createPaymentCollection,
  initPaymentSession,
  completeCart,
  type ShippingOption,
} from '@/lib/medusa';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

type Json = Record<string, unknown>;

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

/* ── Step indicator ── */
const STEPS = ['Email', 'Adresse', 'Livraison', 'Paiement'] as const;
type Step = (typeof STEPS)[number];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="mb-ds-lg flex gap-2">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className="flex-1 text-center text-xs py-2 rounded"
          style={{
            background: i <= idx ? 'var(--ds-accent)' : 'var(--ds-bg-card, var(--ds-bg))',
            color: i <= idx ? '#fff' : 'var(--ds-text-muted)',
            fontWeight: i === idx ? 700 : 400,
            border: `1px solid ${i <= idx ? 'var(--ds-accent)' : 'var(--ds-border)'}`,
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

/* ── Stripe form (mounted inside Elements provider) ── */
function StripeForm({
  clientSecret,
  cartId,
  onSuccess,
}: {
  clientSecret: string;
  cartId: string;
  onSuccess: (orderId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message || 'Erreur de validation');
      setLoading(false);
      return;
    }

    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: window.location.origin + '/checkout',
      },
      redirect: 'if_required',
    });

    if (confirmErr) {
      if (
        confirmErr.payment_intent?.status === 'requires_capture' ||
        confirmErr.payment_intent?.status === 'succeeded'
      ) {
        await finalize();
        return;
      }
      setError(confirmErr.message || 'Erreur de paiement');
      setLoading(false);
      return;
    }

    if (
      paymentIntent?.status === 'requires_capture' ||
      paymentIntent?.status === 'succeeded'
    ) {
      await finalize();
    }
  };

  const finalize = async () => {
    try {
      const result = await completeCart(cartId);
      if (result.type === 'order') {
        onSuccess((result.data as { id: string }).id);
      } else {
        setError('La commande n\'a pas pu être finalisée. Veuillez réessayer.');
      }
    } catch {
      setError('Erreur lors de la finalisation de la commande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-ds-md">
      <PaymentElement onReady={() => setReady(true)} />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || !ready || loading}
        className="ds-btn ds-btn-primary w-full py-3 text-sm disabled:opacity-50"
      >
        {loading ? 'Traitement en cours...' : 'Payer et commander'}
      </button>
    </form>
  );
}

/* ── Main checkout page ── */
export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const [step, setStep] = useState<Step>('Email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState({
    first_name: '',
    last_name: '',
    address_1: '',
    city: '',
    country_code: 'fr',
    postal_code: '',
    phone: '',
  });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState('');

  const cartId = (cart?.id as string) || '';
  const items = ((cart?.items || []) as unknown) as {
    id: string;
    title: string;
    quantity: number;
    total: number;
    thumbnail: string | null;
  }[];
  const total = (cart?.total as number) || 0;
  const currency = (cart?.currency_code as string) || 'eur';

  // redirect if no cart
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('medusa_cart_id')) {
      window.location.href = '/cart';
    }
  }, []);

  /* ── Step 1: Email ── */
  const submitEmail = useCallback(async () => {
    if (!email || !cartId) return;
    setLoading(true);
    setError('');
    try {
      await updateCartEmail(cartId, email);
      setStep('Adresse');
    } catch {
      setError('Impossible de mettre à jour l\'email.');
    } finally {
      setLoading(false);
    }
  }, [email, cartId]);

  /* ── Step 2: Address ── */
  const submitAddress = useCallback(async () => {
    if (!cartId) return;
    setLoading(true);
    setError('');
    try {
      await addShippingAddress(cartId, address);
      const opts = await getShippingOptions(cartId);
      setShippingOptions(opts);
      if (opts.length === 1 && opts[0]) setSelectedShipping(opts[0].id);
      setStep('Livraison');
    } catch {
      setError('Erreur lors de l\'enregistrement de l\'adresse.');
    } finally {
      setLoading(false);
    }
  }, [cartId, address]);

  /* ── Step 3: Shipping ── */
  const submitShipping = useCallback(async () => {
    if (!cartId || !selectedShipping) return;
    setLoading(true);
    setError('');
    try {
      await addShippingMethod(cartId, selectedShipping);
      const pcId = await createPaymentCollection(cartId);
      const pc = await initPaymentSession(pcId) as Json;
      const sessions = (pc.payment_sessions || []) as { data: { client_secret?: string } }[];
      const cs = sessions[0]?.data?.client_secret;
      if (!cs) throw new Error('Pas de client_secret Stripe');
      setClientSecret(cs);
      setStep('Paiement');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'initialisation du paiement.');
    } finally {
      setLoading(false);
    }
  }, [cartId, selectedShipping]);

  /* ── Success ── */
  if (orderId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-ds-xl text-center">
        <div className="ds-card p-ds-xl">
          <div className="text-5xl mb-ds-md">✓</div>
          <h1 className="text-2xl mb-ds-sm" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
            Commande confirmée !
          </h1>
          <p className="text-[var(--ds-text-muted)] mb-ds-md">
            Numéro de commande : <strong>{orderId}</strong>
          </p>
          <p className="text-sm text-[var(--ds-text-muted)] mb-ds-lg">
            Vous recevrez un email de confirmation à <strong>{email}</strong>.
          </p>
          <a href="/shop" className="ds-btn ds-btn-primary inline-block">
            Continuer vos achats
          </a>
        </div>
      </div>
    );
  }

  if (!cart || items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-ds-xl text-center">
        <p className="text-[var(--ds-text-muted)]">Panier vide — rien à commander.</p>
        <a href="/shop" className="ds-btn ds-btn-primary mt-ds-md inline-block">
          Boutique
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-ds-xl">
      <h1 className="mb-ds-md" style={{ fontSize: 'var(--ds-size-h2)', fontWeight: 'var(--ds-weight-black, 900)' }}>
        Checkout
      </h1>

      <StepBar current={step} />

      {error && (
        <div className="mb-ds-md rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Order summary (always visible) ── */}
      <div className="ds-card mb-ds-lg p-ds-md">
        <h2 className="text-sm font-semibold mb-2 text-[var(--ds-text-muted)]">Résumé</h2>
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm py-1 border-b border-[var(--ds-border)] last:border-0">
            <span>{item.title} × {item.quantity}</span>
            <span>{(item.total / 100).toFixed(2)} {currency.toUpperCase()}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 font-bold">
          <span>Total</span>
          <span style={{ color: 'var(--ds-accent)' }}>{(total / 100).toFixed(2)} {currency.toUpperCase()}</span>
        </div>
      </div>

      {/* ── Step 1: Email ── */}
      {step === 'Email' && (
        <div className="ds-card p-ds-lg space-y-ds-md">
          <label className="block">
            <span className="text-sm font-medium">Adresse email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@email.com"
              required
              className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
            />
          </label>
          <button
            onClick={submitEmail}
            disabled={!email || loading}
            className="ds-btn ds-btn-primary w-full py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'Chargement...' : 'Continuer'}
          </button>
        </div>
      )}

      {/* ── Step 2: Address ── */}
      {step === 'Adresse' && (
        <div className="ds-card p-ds-lg space-y-ds-md">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium">Prénom</span>
              <input
                value={address.first_name}
                onChange={(e) => setAddress({ ...address, first_name: e.target.value })}
                required
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Nom</span>
              <input
                value={address.last_name}
                onChange={(e) => setAddress({ ...address, last_name: e.target.value })}
                required
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium">Adresse</span>
            <input
              value={address.address_1}
              onChange={(e) => setAddress({ ...address, address_1: e.target.value })}
              required
              className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block col-span-1">
              <span className="text-xs font-medium">Code postal</span>
              <input
                value={address.postal_code}
                onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                required
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-medium">Ville</span>
              <input
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                required
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium">Pays</span>
              <select
                value={address.country_code}
                onChange={(e) => setAddress({ ...address, country_code: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              >
                <option value="fr">France</option>
                <option value="be">Belgique</option>
                <option value="de">Allemagne</option>
                <option value="es">Espagne</option>
                <option value="it">Italie</option>
                <option value="nl">Pays-Bas</option>
                <option value="gb">Royaume-Uni</option>
                <option value="pt">Portugal</option>
                <option value="at">Autriche</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">Téléphone (optionnel)</span>
              <input
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--ds-border)] bg-[var(--ds-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ds-accent)]"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('Email')} className="ds-btn flex-1 py-2.5 text-sm">
              Retour
            </button>
            <button
              onClick={submitAddress}
              disabled={!address.first_name || !address.last_name || !address.address_1 || !address.city || !address.postal_code || loading}
              className="ds-btn ds-btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Continuer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Shipping ── */}
      {step === 'Livraison' && (
        <div className="ds-card p-ds-lg space-y-ds-md">
          <h2 className="text-sm font-semibold">Mode de livraison</h2>
          {shippingOptions.length === 0 ? (
            <p className="text-sm text-[var(--ds-text-muted)]">Aucune option de livraison disponible pour cette adresse.</p>
          ) : (
            <div className="space-y-2">
              {shippingOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors"
                  style={{
                    borderColor: selectedShipping === opt.id ? 'var(--ds-accent)' : 'var(--ds-border)',
                    background: selectedShipping === opt.id ? 'var(--ds-bg-card, var(--ds-bg))' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={opt.id}
                    checked={selectedShipping === opt.id}
                    onChange={() => setSelectedShipping(opt.id)}
                    className="accent-[var(--ds-accent)]"
                  />
                  <span className="flex-1 text-sm font-medium">{opt.name}</span>
                  <span className="text-sm font-bold">{(opt.amount / 100).toFixed(2)} {currency.toUpperCase()}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep('Adresse')} className="ds-btn flex-1 py-2.5 text-sm">
              Retour
            </button>
            <button
              onClick={submitShipping}
              disabled={!selectedShipping || loading}
              className="ds-btn ds-btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Continuer vers le paiement'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Payment (Stripe Elements) ── */}
      {step === 'Paiement' && clientSecret && (
        <div className="ds-card p-ds-lg">
          <h2 className="text-sm font-semibold mb-ds-md">Paiement sécurisé</h2>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
            key={clientSecret}
          >
            <StripeForm
              clientSecret={clientSecret}
              cartId={cartId}
              onSuccess={(id) => {
                setOrderId(id);
                clearCart();
              }}
            />
          </Elements>
          <button onClick={() => setStep('Livraison')} className="ds-btn mt-ds-md w-full py-2 text-sm">
            Retour
          </button>
        </div>
      )}
    </div>
  );
}
