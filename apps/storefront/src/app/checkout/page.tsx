'use client';

import { useCart } from '@/context/cart-context';
import { formatEur } from '@/lib/money';
import { trackBeginCheckout } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function CheckoutPage() {
  const { items, subtotal, discountEur, shippingEurFor, totalFor, promoCode, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const shippingCents = Math.round(shippingEurFor('standard') * 100);

  useEffect(() => {
    if (items.length > 0) {
      trackBeginCheckout(totalFor('standard'), 'EUR');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckout() {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            imageUrl: i.imageUrl,
          })),
          shippingCents,
          promoCode: promoCode || undefined,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? 'Erreur lors de la création du paiement');
        return;
      }

      window.location.href = data.url;
    } catch {
      setError('Erreur réseau — veuillez réessayer');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center font-['Noto_Sans_JP',sans-serif]">
        <h1 className="mb-4 text-2xl font-bold text-[#333]">Panier vide</h1>
        <p className="text-[#999]">
          Ajoutez des articles avant de passer commande.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-[#D9312B] px-8 py-3 font-bold text-white hover:bg-[#c62828] transition-colors"
        >
          Voir la boutique
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-['Noto_Sans_JP',sans-serif]">
      <nav className="mb-6 text-sm text-[#999]">
        <Link href="/" className="hover:text-[#D9312B] transition-colors">Accueil</Link>
        <span className="mx-2">›</span>
        <Link href="/cart" className="hover:text-[#D9312B] transition-colors">Panier</Link>
        <span className="mx-2">›</span>
        <span className="text-[#333]">Commande</span>
      </nav>

      <h1 className="mb-8 inline-block pb-2 text-2xl font-bold tracking-wider text-[#333] border-b-[3px] border-[#D9312B]">
        COMMANDE
      </h1>

      <div className="space-y-4 rounded-xl border border-[#eee] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#999]">Récapitulatif</h2>

        <ul className="divide-y divide-[#eee]">
          {items.map(item => (
            <li key={item.productId} className="flex items-center gap-4 py-3">
              <img
                src={item.imageUrl || '/placeholder-product.svg'}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[#333]">{item.name}</p>
                <p className="text-xs text-[#999]">Qté : {item.quantity}</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-[#333]">
                {formatEur(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t-2 border-[#D9312B] pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#999]">Sous-total</dt>
            <dd className="font-medium text-[#333]">{formatEur(subtotal)}</dd>
          </div>
          {discountEur > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#999]">Réduction</dt>
              <dd className="font-medium text-green-600">−{formatEur(discountEur)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-[#999]">Livraison</dt>
            <dd className="font-medium text-[#333]">{formatEur(shippingEurFor('standard'))}</dd>
          </div>
          <div className="flex justify-between border-t border-[#eee] pt-3 text-base font-bold text-[#333]">
            <dt>Total</dt>
            <dd>{formatEur(totalFor('standard'))}</dd>
          </div>
        </dl>

        {error && (
          <p className="text-sm text-[#D9312B]">{error}</p>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="mt-4 w-full rounded-full bg-[#D9312B] px-6 py-3 text-center font-bold tracking-wider text-white hover:bg-[#c62828] disabled:opacity-50 transition-colors"
        >
          {loading ? 'REDIRECTION VERS LE PAIEMENT…' : 'PAYER AVEC STRIPE'}
        </button>

        <p className="text-center text-xs text-[#999]">
          Paiement sécurisé par Stripe. Vous serez redirigé vers la page de paiement.
        </p>
      </div>
    </main>
  );
}
