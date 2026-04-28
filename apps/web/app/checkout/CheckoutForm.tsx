'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, type StoreCart, type StoreShippingOption } from '@/lib/medusa-store';
import { StripePayment } from './StripePayment';

const COUNTRIES = [
  { code: 'fr', name: 'France' },
  { code: 'be', name: 'Belgique' },
  { code: 'de', name: 'Allemagne' },
  { code: 'it', name: 'Italie' },
  { code: 'nl', name: 'Pays-Bas' },
  { code: 'pt', name: 'Portugal' },
  { code: 'es', name: 'Espagne' },
];

interface Props {
  cart: StoreCart;
  shippingOptions: StoreShippingOption[];
  shippingError: string | null;
  stripeEnabled: boolean;
  stripePublishableKey: string;
}

export function CheckoutForm({ cart, shippingOptions, shippingError, stripeEnabled, stripePublishableKey }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'address' | 'shipping' | 'payment'>(
    cart.shipping_address?.country_code ? (cart.shipping_methods?.length ? 'payment' : 'shipping') : 'address',
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: cart.email ?? '',
    first_name: cart.shipping_address?.first_name ?? '',
    last_name: cart.shipping_address?.last_name ?? '',
    address_1: cart.shipping_address?.address_1 ?? '',
    city: cart.shipping_address?.city ?? '',
    postal_code: cart.shipping_address?.postal_code ?? '',
    province: cart.shipping_address?.province ?? '',
    country_code: cart.shipping_address?.country_code ?? 'fr',
    phone: cart.shipping_address?.phone ?? '',
  });

  function setField<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function submitAddress() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        setStep('shipping');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  function pickShipping(optionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout/shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        setStep('payment');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  function complete() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        if (data.orderId) {
          router.push(`/order/${data.orderId}`);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  return (
    <div className="space-y-6">
      <ol className="flex text-xs gap-2 text-zinc-500">
        <Step n={1} active={step === 'address'} done={step !== 'address'}>Adresse</Step>
        <Step n={2} active={step === 'shipping'} done={step === 'payment'}>Livraison</Step>
        <Step n={3} active={step === 'payment'} done={false}>Paiement</Step>
      </ol>

      {step === 'address' && (
        <div className="space-y-3">
          <Input label="Email" value={form.email} onChange={(v) => setField('email', v)} type="email" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={form.first_name} onChange={(v) => setField('first_name', v)} />
            <Input label="Nom" value={form.last_name} onChange={(v) => setField('last_name', v)} />
          </div>
          <Input label="Adresse" value={form.address_1} onChange={(v) => setField('address_1', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code postal" value={form.postal_code} onChange={(v) => setField('postal_code', v)} />
            <Input label="Ville" value={form.city} onChange={(v) => setField('city', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Région / Département" value={form.province} onChange={(v) => setField('province', v)} />
            <Select label="Pays" value={form.country_code} onChange={(v) => setField('country_code', v)} options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
          </div>
          <Input label="Téléphone" value={form.phone} onChange={(v) => setField('phone', v)} type="tel" />
          <button
            onClick={submitAddress}
            disabled={
              pending ||
              !form.email ||
              !form.first_name ||
              !form.last_name ||
              !form.address_1 ||
              !form.city ||
              !form.postal_code ||
              !form.province ||
              !form.phone
            }
            className="bg-black text-white px-6 py-3 rounded-full hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? '…' : 'Continuer'}
          </button>
        </div>
      )}

      {step === 'shipping' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Livraison</h2>
          {shippingError && <p className="text-red-600 text-sm">{shippingError}</p>}
          {shippingOptions.length === 0 && !shippingError && (
            <div className="border border-amber-300 bg-amber-50 text-amber-900 p-4 rounded text-sm">
              Aucune option de livraison disponible pour cette adresse — config Medusa à compléter.
            </div>
          )}
          {shippingOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => pickShipping(opt.id)}
              disabled={pending}
              className="w-full text-left border rounded p-4 hover:bg-zinc-50 flex justify-between items-center"
            >
              <span className="font-medium">{opt.name}</span>
              <span>{formatMoney(opt.amount, cart.currency_code)}</span>
            </button>
          ))}
          <button onClick={() => setStep('address')} className="text-sm underline text-zinc-600">Modifier l’adresse</button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Paiement</h2>
          {stripeEnabled && stripePublishableKey ? (
            <StripePayment
              publishableKey={stripePublishableKey}
              amountLabel={formatMoney(cart.total, cart.currency_code)}
            />
          ) : (
            <>
              <div className="border border-amber-300 bg-amber-50 text-amber-900 p-4 rounded text-sm space-y-1">
                <p className="font-medium">Mode test (paiement manuel)</p>
                <p>Stripe non configuré — la commande est créée sans capture de carte.</p>
              </div>
              <button
                onClick={complete}
                disabled={pending}
                className="bg-black text-white px-6 py-3 rounded-full hover:bg-zinc-800 disabled:opacity-60 w-full"
              >
                {pending ? '…' : `Confirmer la commande (${formatMoney(cart.total, cart.currency_code)})`}
              </button>
            </>
          )}
          <button onClick={() => setStep('shipping')} className="text-sm underline text-zinc-600">Modifier la livraison</button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function Step({ n, active, done, children }: { n: number; active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${active ? 'text-black font-medium' : done ? 'text-green-700' : ''}`}>
      <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${active ? 'bg-black text-white' : done ? 'bg-green-600 text-white' : 'bg-zinc-200'}`}>{n}</span>
      {children}
    </li>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-zinc-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-3 py-2" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-zinc-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
