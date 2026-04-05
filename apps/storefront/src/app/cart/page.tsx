'use client';

import { useCart } from '@/context/cart-context';
import { formatEur } from '@/lib/money';
import { shippingEur } from '@/lib/shipping';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    promoCode,
    setPromoCode,
    validatedDiscount,
    setValidatedDiscount,
    discountEur,
  } = useCart();

  const [promoInput, setPromoInput] = useState(promoCode);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    setPromoInput(promoCode);
  }, [promoCode]);

  const subAfterDiscount = Math.max(0, subtotal - discountEur);
  const standardShip = validatedDiscount?.freeShipping ? 0 : shippingEur('standard', subAfterDiscount);

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) {
      setValidatedDiscount(null);
      setPromoError(null);
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal: subtotal }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        error?: string;
        discount?: { discountCents: number; finalCents: number; freeShipping?: boolean };
        discountCents?: number;
      };
      if (!res.ok || !data.valid) {
        setValidatedDiscount(null);
        setPromoError(typeof data.error === 'string' ? data.error : 'Code invalide');
        return;
      }
      const d = data.discount;
      if (!d) {
        setPromoError('Réponse invalide');
        return;
      }
      setPromoCode(code);
      setValidatedDiscount({
        code,
        discountCents: d.discountCents,
        finalCents: d.finalCents,
        freeShipping: Boolean(d.freeShipping),
      });
    } catch {
      setPromoError('Erreur réseau');
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, setPromoCode, setValidatedDiscount, subtotal]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-['Noto_Sans_JP',sans-serif]">
      {/* Breadcrumb */}
      <nav className="mb-6 text-[0.8125rem] text-[#999999]">
        <Link href="/" className="hover:text-[#D9312B] transition-colors">Accueil</Link>
        <span className="mx-2">›</span>
        <span className="text-[#333333]">Panier</span>
      </nav>

      {/* Title */}
      <h1 className="mb-8 inline-block pb-2 text-[1.5rem] font-bold tracking-wider text-[#333333] border-b-[3px] border-[#D9312B]">
        PANIER
      </h1>

      {items.length === 0 ? (
        <p className="text-[0.875rem] text-[#999999]">
          Votre panier est vide.{' '}
          <Link href="/" className="text-[#D9312B] hover:text-[#c62828] font-medium transition-colors">
            Découvrir la boutique
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map(line => (
            <li
              key={line.productId}
              className="flex gap-4 rounded-xl border border-[#eeeeee] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg transition-shadow hover:shadow-md">
                <img
                  src={line.imageUrl || '/placeholder-product.svg'}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-[0.875rem] font-medium text-[#333333]">
                    {line.name}
                  </span>
                  <span className="shrink-0 font-['Noto_Sans_JP',sans-serif] text-[0.8125rem] text-[#999999]">
                    {formatEur(line.unitPrice)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="sr-only" htmlFor={`qty-${line.productId}`}>
                    Quantité
                  </label>
                  <input
                    id={`qty-${line.productId}`}
                    type="number"
                    min={1}
                    className="w-20 rounded-lg border border-[#eeeeee] bg-white px-2 py-1 text-[0.8125rem] text-[#333333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors"
                    value={line.quantity}
                    onChange={e => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n)) updateQuantity(line.productId, n);
                    }}
                  />
                  <button
                    type="button"
                    className="text-[0.8125rem] text-[#D9312B] hover:text-[#c62828] font-medium transition-colors"
                    onClick={() => removeItem(line.productId)}
                  >
                    Supprimer
                  </button>
                </div>
                <p className="text-[0.8125rem] text-[#999999]">
                  Total : {formatEur(line.unitPrice * line.quantity)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <section className="mt-8 space-y-4 rounded-xl border border-[#eeeeee] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          {/* Promo code */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="promo" className="mb-1 block text-[0.75rem] font-medium uppercase tracking-wide text-[#999999]">
                Code promo
              </label>
              <input
                id="promo"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value)}
                className="w-full rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-[0.875rem] text-[#333333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors"
                placeholder="CODE"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyPromo()}
              disabled={promoLoading}
              className="rounded-lg bg-[#D9312B] px-5 py-2 text-[0.8125rem] font-bold tracking-wider text-white hover:bg-[#c62828] disabled:opacity-50 transition-colors"
            >
              {promoLoading ? 'APPLICATION…' : 'APPLIQUER'}
            </button>
          </div>
          {promoError && (
            <p className="text-[0.8125rem] text-[#D9312B]">{promoError}</p>
          )}
          {validatedDiscount && (
            <p className="text-[0.8125rem] text-green-600">
              Code appliqué : {validatedDiscount.code}
            </p>
          )}

          {/* Summary */}
          <dl className="space-y-2 border-t-2 border-[#D9312B] pt-4 text-[0.875rem]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#999999]">Sous-total</dt>
              <dd className="font-medium text-[#333333]">{formatEur(subtotal)}</dd>
            </div>
            {discountEur > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#999999]">Réduction</dt>
                <dd className="font-medium text-green-600">
                  −{formatEur(discountEur)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-[#999999]">Livraison (standard, est.)</dt>
              <dd className="font-medium text-[#333333]">
                {validatedDiscount?.freeShipping ? formatEur(0) : formatEur(standardShip)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[#eeeeee] pt-3 text-[1rem] font-bold text-[#333333]">
              <dt>Total (est.)</dt>
              <dd>
                {formatEur(subAfterDiscount + standardShip)}
              </dd>
            </div>
          </dl>

          <Link
            href="/checkout"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#D9312B] px-6 py-3 text-center text-[0.9375rem] font-bold tracking-wider text-white hover:bg-[#c62828] transition-colors"
          >
            PASSER COMMANDE
          </Link>
        </section>
      )}
    </main>
  );
}
