'use client';

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
      await fetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItemId: item.id, quantity: newQty }),
      });
      router.refresh();
    });
  }

  return (
    <tr>
      <td className="p-4">
        <div className="flex items-center gap-3">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnail} alt={item.title} className="w-14 h-14 rounded object-cover bg-zinc-100" />
          ) : (
            <div className="w-14 h-14 rounded bg-zinc-100" />
          )}
          <div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-xs text-zinc-500">{formatMoney(item.unit_price, currency)} / unité</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="inline-flex items-center border rounded">
          <button
            onClick={() => update(Math.max(0, qty - 1))}
            disabled={pending}
            className="px-2 py-1 hover:bg-zinc-100"
          >
            −
          </button>
          <span className="px-3 text-sm">{qty}</span>
          <button
            onClick={() => update(qty + 1)}
            disabled={pending}
            className="px-2 py-1 hover:bg-zinc-100"
          >
            +
          </button>
        </div>
      </td>
      <td className="p-4 text-right text-sm">{formatMoney(item.total, currency)}</td>
      <td className="p-4 text-right">
        <button
          onClick={() => update(0)}
          disabled={pending}
          className="text-xs text-red-600 hover:underline"
        >
          Retirer
        </button>
      </td>
    </tr>
  );
}
