'use client';

import Link from 'next/link';
import type { FC } from 'react';
import type { LayoutMode, ProductDto } from '@/lib/product-types';

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export interface ProductGridProps {
  items: ProductDto[];
  layout: LayoutMode;
  loading: boolean;
  error: string | null;
}

export const ProductGrid: FC<ProductGridProps> = ({ items, layout, loading, error }) => {
  if (error) {
    return (
      <div
        className="rounded-[var(--dashboard-radius-card)] border p-6 text-sm"
        style={{
          borderColor: 'var(--dashboard-error)',
          background: 'var(--dashboard-card)',
          color: 'var(--dashboard-error)',
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy
        aria-live="polite"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="h-64 animate-pulse rounded-[var(--dashboard-radius-card)]"
            style={{ background: 'var(--dashboard-card-2)' }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
        Aucun produit ne correspond à votre recherche.
      </p>
    );
  }

  const gridClass =
    layout === 'grid'
      ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
      : 'flex flex-col gap-3';

  return (
    <ul className={gridClass}>
      {items.map(product => (
        <li key={product.id}>
          <Link href={`/shop/${product.id}`} className="block h-full">
            <article
              className={
                layout === 'grid'
                  ? 'flex h-full flex-col overflow-hidden rounded-[var(--dashboard-radius-card)] border transition-all hover:shadow-[var(--op-shadow-hover)] hover:-translate-y-1'
                  : 'flex gap-4 rounded-[var(--dashboard-radius-card)] border p-3 transition-all hover:shadow-[var(--op-shadow-hover)]'
              }
              style={{
                borderColor: 'var(--dashboard-border-mid)',
                background: 'var(--dashboard-card)',
              }}
            >
              <div
                className={
                  layout === 'grid'
                    ? 'relative aspect-[4/3] w-full overflow-hidden'
                    : 'relative h-28 w-28 shrink-0 overflow-hidden rounded-[var(--dashboard-radius-input)]'
                }
                style={{ background: 'var(--dashboard-card-2)' }}
              >
                {product.imageUrls[0] ? (
                  <img
                    src={product.imageUrls[0]}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xs"
                    style={{ color: 'var(--dashboard-text-ghost)' }}
                  >
                    Pas d&apos;image
                  </div>
                )}
                {!product.inStock && (
                  <span
                    className="absolute right-2 top-2 rounded-[var(--dashboard-radius-button)] px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      background: 'var(--dashboard-warning)',
                      color: 'var(--dashboard-page)',
                    }}
                  >
                    Rupture
                  </span>
                )}
              </div>
              <div className={layout === 'grid' ? 'flex flex-1 flex-col gap-1 p-4' : 'min-w-0 flex-1'}>
                <p
                  className="text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: 'var(--dashboard-text-muted)' }}
                >
                  {product.category}
                </p>
                <h3
                  className={`font-semibold leading-snug transition-colors hover:text-[#D9312B] ${layout === 'list' ? 'text-base' : 'text-sm'}`}
                  style={{ color: 'var(--dashboard-text-bright)' }}
                >
                  {product.name}
                </h3>
                {layout === 'list' && product.description ? (
                  <p
                    className="mt-1 line-clamp-2 text-sm"
                    style={{ color: 'var(--dashboard-text-secondary)' }}
                  >
                    {product.description}
                  </p>
                ) : null}
                <p
                  className={`mt-auto font-[family-name:var(--font-mono)] ${layout === 'grid' ? 'mt-2 text-lg' : 'mt-2 text-base'}`}
                  style={{ color: 'var(--dashboard-accent)' }}
                >
                  {formatEur(product.priceCents)}
                </p>
              </div>
            </article>
          </Link>
        </li>
      ))}
    </ul>
  );
};
