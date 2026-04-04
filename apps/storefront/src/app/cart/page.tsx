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
      <div className="mx-auto max-w-3xl px-4 py-ds-xl">
        <h1 className="mb-ds-lg" style={{ fontSize: 'var(--ds-size-h2)', fontWeight: 'var(--ds-weight-black, 900)' }}>
          Panier
        </h1>
        <div className="ds-card border-dashed p-ds-xl text-center text-[var(--ds-text-muted)]">
          <p className="text-lg">Votre panier est vide</p>
          <a href="/shop" className="ds-btn ds-btn-primary mt-ds-md inline-block text-sm">
            Continuer vos achats
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-ds-xl">
      <h1 className="mb-ds-lg" style={{ fontSize: 'var(--ds-size-h2)', fontWeight: 'var(--ds-weight-black, 900)' }}>
        Panier
      </h1>

      <div className="space-y-ds-md">
        {items.map((item) => (
          <div key={item.id} className="ds-card flex items-center gap-ds-md p-ds-md">
            {item.thumbnail && (
              <a href={`/product/${item.product?.handle}`}>
                <img src={item.thumbnail} alt={item.title} className="h-20 w-20 object-cover" style={{ borderRadius: 'var(--ds-radius)' }} />
              </a>
            )}
            <div className="flex-1">
              <a href={`/product/${item.product?.handle}`} className="font-medium hover:text-[var(--ds-accent)]">
                {item.title}
              </a>
              <p className="text-sm text-[var(--ds-text-muted)]">
                {(item.unit_price / 100).toFixed(2)} {currencyCode.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (item.quantity <= 1) removeItem(item.id);
                  else updateItem(item.id, item.quantity - 1);
                }}
                className="ds-btn px-2 py-1 text-sm disabled:opacity-50"
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center font-medium">{item.quantity}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => updateItem(item.id, item.quantity + 1)}
                className="ds-btn px-2 py-1 text-sm disabled:opacity-50"
              >
                +
              </button>
            </div>
            <p className="min-w-[5rem] text-right" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
              {(item.total / 100).toFixed(2)} {currencyCode.toUpperCase()}
            </p>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-[var(--ds-text-muted)] hover:text-red-500"
              aria-label="Supprimer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-ds-lg ds-card flex items-center justify-between p-ds-lg">
        <span className="text-lg font-medium">Total</span>
        <span className="text-2xl" style={{ fontWeight: 'var(--ds-weight-black, 900)', color: 'var(--ds-accent)' }}>
          {(total / 100).toFixed(2)} {currencyCode.toUpperCase()}
        </span>
      </div>

      <div className="mt-ds-lg flex gap-3">
        <a href="/shop" className="ds-btn flex-1 text-center">
          Continuer les achats
        </a>
        <a href="/checkout" className="ds-btn ds-btn-primary flex-1 text-center">
          Commander
        </a>
      </div>
    </div>
  );
}
