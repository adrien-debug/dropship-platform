'use client';

import { useCart } from '@/lib/cart-context';

interface LineItem {
  id: string;
  title: string;
  quantity: number;
  thumbnail: string | null;
  unit_price: number;
  total: number;
  variant: { id: string; title: string };
  product: { handle: string };
}

export default function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const items = ((cart?.items || []) as unknown) as LineItem[];
  const total = (cart?.total as number) || 0;
  const currencyCode = (cart?.currency_code as string) || 'eur';

  if (!cart || items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Panier</h1>
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p className="text-lg">Votre panier est vide</p>
          <a href="/shop" className="mt-4 inline-block text-sm text-black underline">
            Continuer vos achats
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Panier</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-xl border p-4">
            {item.thumbnail && (
              <a href={`/product/${item.product?.handle}`}>
                <img src={item.thumbnail} alt={item.title} className="h-20 w-20 rounded-lg object-cover" />
              </a>
            )}
            <div className="flex-1">
              <a href={`/product/${item.product?.handle}`} className="font-medium hover:underline">
                {item.title}
              </a>
              <p className="text-sm text-gray-500">{(item.unit_price / 100).toFixed(2)} {currencyCode.toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (item.quantity <= 1) removeItem(item.id);
                  else updateItem(item.id, item.quantity - 1);
                }}
                className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center font-medium">{item.quantity}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => updateItem(item.id, item.quantity + 1)}
                className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="min-w-[5rem] text-right font-bold">{(item.total / 100).toFixed(2)} {currencyCode.toUpperCase()}</p>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-gray-400 hover:text-red-500"
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border bg-gray-50 p-6">
        <span className="text-lg font-medium">Total</span>
        <span className="text-2xl font-bold">{(total / 100).toFixed(2)} {currencyCode.toUpperCase()}</span>
      </div>

      <div className="mt-6 flex gap-3">
        <a href="/shop" className="flex-1 rounded-full border py-3 text-center font-medium hover:bg-gray-50">
          Continuer les achats
        </a>
        <a href="/checkout" className="flex-1 rounded-full bg-black py-3 text-center font-medium text-white hover:bg-gray-800">
          Commander
        </a>
      </div>
    </div>
  );
}
