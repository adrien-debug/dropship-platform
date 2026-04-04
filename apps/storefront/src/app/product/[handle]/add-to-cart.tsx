'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';

export function AddToCartButton({ variantId }: { variantId: string }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    await addItem(variantId, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Quantite</label>
        <div className="flex items-center rounded-lg border">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-lg">−</button>
          <span className="min-w-[2rem] text-center font-medium">{qty}</span>
          <button type="button" onClick={() => setQty(qty + 1)} className="px-3 py-2 text-lg">+</button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-full bg-black py-3 font-medium text-white transition hover:bg-gray-800"
      >
        {added ? 'Ajoute !' : 'Ajouter au panier'}
      </button>
      {added && (
        <a href="/cart" className="block text-center text-sm text-gray-600 underline">
          Voir le panier
        </a>
      )}
    </div>
  );
}
