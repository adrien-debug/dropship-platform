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
    <div className="grid grid-cols-2 gap-ds-md sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const variant = p.variants[0];
        return (
          <article key={p.id} className="ds-card group flex h-full flex-col">
            <a href={`/product/${p.handle}`} className="relative aspect-square w-full overflow-hidden bg-[var(--ds-bg-alt)]">
              {p.thumbnail && (
                <img
                  src={p.thumbnail}
                  alt={p.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </a>
            <div className="flex flex-1 flex-col gap-2 p-ds-md">
              <a href={`/product/${p.handle}`} className="line-clamp-2 text-sm font-medium hover:text-[var(--ds-accent)]">
                {p.title}
              </a>
              <p className="mt-auto text-lg" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
                {formatPrice(variant)}
              </p>
              {variant && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => addItem(variant.id)}
                  className="ds-btn ds-btn-primary mt-2 w-full text-sm disabled:opacity-50"
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
