'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AddToCartButton({ variantId }: { variantId: string }) {
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
          body: JSON.stringify({ variantId, quantity: qty }),
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm">Quantité</label>
        <input
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
          className="w-20 border rounded px-2 py-1 text-sm"
        />
      </div>
      <button
        onClick={submit}
        disabled={pending}
        className="bg-black text-white px-6 py-3 rounded-md hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? 'Ajout…' : 'Ajouter au panier'}
      </button>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}
