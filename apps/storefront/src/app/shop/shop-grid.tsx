'use client';

import { useCart } from '@/lib/cart-context';
import type { MedusaProduct } from '@/lib/medusa';

function formatPrice(variant: MedusaProduct['variants'][0] | undefined): string {
  if (!variant) return '—';
  const cp = variant.calculated_price;
  if (!cp) return '—';
  return `${(cp.calculated_amount / 100).toFixed(2)} ${cp.currency_code.toUpperCase()}`;
}

export function ShopGrid({ products }: { products: MedusaProduct[] }) {
  const { addItem, loading } = useCart();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const variant = p.variants[0];
        return (
          <article
            key={p.id}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
          >
            <a href={`/product/${p.handle}`} className="relative aspect-square w-full overflow-hidden bg-gray-50">
              {p.thumbnail && (
                <img
                  src={p.thumbnail}
                  alt={p.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </a>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <a href={`/product/${p.handle}`} className="line-clamp-2 text-sm font-medium hover:underline">
                {p.title}
              </a>
              <p className="mt-auto text-lg font-bold">{formatPrice(variant)}</p>
              {variant && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => addItem(variant.id)}
                  className="mt-2 w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? '...' : 'Ajouter au panier'}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
