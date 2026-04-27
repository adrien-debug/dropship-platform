'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  variantId: string;
  storeSlug?: string;
  /** Visual variant. `dark` = black on white card, `light` = white on dark surface. */
  tone?: 'dark' | 'light';
  /** Override CTA copy (default "Ajouter au panier"). */
  label?: string;
  /**
   * Show the inline quantity stepper above the button. Off by default —
   * landing pages should defer the qty choice to the cart page so the hero
   * CTA stays a single, decisive action. Turn on for the standalone product
   * page where qty selection in-context makes sense.
   */
  showQuantity?: boolean;
}

export function AddToCartButton({ variantId, storeSlug, tone = 'dark', label = 'Ajouter au panier', showQuantity = false }: Props) {
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, quantity: qty, ...(storeSlug ? { slug: storeSlug } : {}) }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur ajout panier');
        router.push('/cart');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  const stepDown = () => setQty((q) => Math.max(1, q - 1));
  const stepUp = () => setQty((q) => Math.min(99, q + 1));

  const stepperBorder = tone === 'dark' ? 'border-zinc-200' : 'border-white/20';
  const stepperText = tone === 'dark' ? 'text-zinc-900' : 'text-white';
  const stepperBtnHover = tone === 'dark' ? 'hover:bg-zinc-100' : 'hover:bg-white/10';
  const buttonBase =
    tone === 'dark'
      ? 'bg-zinc-950 text-white hover:bg-black'
      : 'bg-white text-zinc-950 hover:bg-zinc-50';

  return (
    <div className="w-full">
      {showQuantity && (
        <div className={`flex items-center justify-between rounded-full border ${stepperBorder} mb-3 px-1.5 py-1.5`}>
          <button
            type="button"
            onClick={stepDown}
            aria-label="Diminuer la quantité"
            className={`h-9 w-9 rounded-full flex items-center justify-center text-lg font-light ${stepperText} ${stepperBtnHover} transition-colors disabled:opacity-30`}
            disabled={qty <= 1}
          >
            −
          </button>
          <div className={`text-sm font-medium ${stepperText} tabular-nums`}>{qty}</div>
          <button
            type="button"
            onClick={stepUp}
            aria-label="Augmenter la quantité"
            className={`h-9 w-9 rounded-full flex items-center justify-center text-lg font-light ${stepperText} ${stepperBtnHover} transition-colors`}
          >
            +
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={`group relative w-full overflow-hidden rounded-full ${buttonBase} px-7 py-4 text-sm font-medium uppercase tracking-[0.18em] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-[0_22px_40px_-18px_rgba(0,0,0,0.55)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none`}
      >
        <span className="inline-flex items-center justify-center gap-3">
          {pending ? (
            <>
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
                aria-hidden="true"
              />
              Ajout en cours
            </>
          ) : (
            <>
              {label}
              <svg
                aria-hidden="true"
                width="14"
                height="10"
                viewBox="0 0 14 10"
                fill="none"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                <path d="M0 5h12m0 0L8 1m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </span>
      </button>

      {error && <p className="text-red-600 text-xs mt-3 text-center">{error}</p>}
    </div>
  );
}
