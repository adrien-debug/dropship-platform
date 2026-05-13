'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, type StoreLineItem } from '@/lib/medusa-store';

export function CartLineRow({ item, currency }: { item: StoreLineItem; currency: string }) {
  const [qty, setQty] = useState(item.quantity);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(newQty: number) {
    setQty(newQty);
    startTransition(async () => {
      await apiFetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId: item.id, quantity: newQty }),
      });
      router.refresh();
    });
  }

  return (
    <tr>
      <td className="p-6">
        <div className="flex items-center gap-5">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-20 h-20 rounded-lg object-cover bg-zinc-100"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-zinc-100" />
          )}
          <div>
            <p className="font-medium text-base text-zinc-900">{item.title}</p>
            <p className="text-sm text-zinc-500 mt-1">{formatMoney(item.unit_price, currency)} / unité</p>
          </div>
        </div>
      </td>
      <td className="p-6">
        <div className="inline-flex items-center border border-zinc-200 rounded-full">
          <button
            onClick={() => update(Math.max(0, qty - 1))}
            disabled={pending}
            aria-label="Diminuer la quantité"
            className="h-10 w-10 rounded-full flex items-center justify-center text-lg font-light hover:bg-zinc-100 transition-colors disabled:opacity-40"
          >
            −
          </button>
          <span className="px-4 text-base font-medium tabular-nums">{qty}</span>
          <button
            onClick={() => update(qty + 1)}
            disabled={pending}
            aria-label="Augmenter la quantité"
            className="h-10 w-10 rounded-full flex items-center justify-center text-lg font-light hover:bg-zinc-100 transition-colors disabled:opacity-40"
          >
            +
          </button>
        </div>
      </td>
      <td className="p-6 text-right text-base font-medium text-zinc-900">{formatMoney(item.total, currency)}</td>
      <td className="p-6 text-right">
        <button
          onClick={() => update(0)}
          disabled={pending}
          className="text-sm text-zinc-500 hover:text-red-600 transition-colors"
        >
          Retirer
        </button>
      </td>
    </tr>
  );
}
