'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { ProductDto } from '@/lib/product-types';
import { useCart } from '@/context/cart-context';

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: 'var(--op-border)' }}
    >
      <div className="aspect-square w-full" style={{ background: 'var(--op-cream)' }} />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded" style={{ background: 'var(--op-border)' }} />
        <div className="h-4 w-1/3 rounded" style={{ background: 'var(--op-border)' }} />
        <div className="h-10 w-full rounded-full" style={{ background: 'var(--op-border)' }} />
      </div>
    </div>
  );
}

export default function NewArrivalsPage() {
  const { addItem } = useCart();

  const [items, setItems] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products?limit=24&sort=random');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { items: ProductDto[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--op-cream)' }}>
      {/* Hero banner */}
      <section
        className="relative flex h-48 items-center justify-center overflow-hidden sm:h-64"
        style={{
          background: 'linear-gradient(135deg, #D9312B 0%, #8B0000 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 40px)',
          }}
        />
        <h1
          className="relative z-10 text-4xl font-bold tracking-widest text-white sm:text-5xl"
          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
        >
          NOUVEAUTES
        </h1>
      </section>

      {/* Title bar */}
      <div
        className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"
      >
        <div
          className="border-b-2 pb-4"
          style={{ borderColor: 'var(--op-brand)' }}
        >
          <h2
            className="text-xl font-semibold tracking-wide"
            style={{ color: 'var(--op-ink)', fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            Les derniers produits
          </h2>
        </div>
      </div>

      {/* Product grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div
            className="mb-6 rounded-xl border p-4 text-sm"
            style={{
              borderColor: 'var(--dashboard-error)',
              color: 'var(--dashboard-error)',
              background: 'rgba(220,38,38,0.06)',
            }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((product) => (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow duration-300"
                  style={{
                    borderColor: 'var(--op-border)',
                    boxShadow: 'var(--op-shadow)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      'var(--op-shadow-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      'var(--op-shadow)';
                  }}
                >
                  {/* Image */}
                  <div className="relative aspect-square w-full overflow-hidden" style={{ background: 'var(--op-cream)' }}>
                    {product.imageUrls[0] && (
                      <Image
                        src={product.imageUrls[0]}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    {/* NEW badge */}
                    <span
                      className="absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-bold tracking-wider text-white"
                      style={{ background: 'var(--op-brand)' }}
                    >
                      NEW
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3
                      className="text-sm font-semibold leading-snug sm:text-base"
                      style={{ color: 'var(--op-ink)', fontFamily: "'Noto Sans JP', sans-serif" }}
                    >
                      {product.name}
                    </h3>
                    <p
                      className="mt-auto text-base font-bold"
                      style={{ color: 'var(--op-brand)' }}
                    >
                      {formatPrice(product.priceCents)}
                    </p>
                    <button
                      type="button"
                      disabled={!product.inStock}
                      className="mt-1 w-full rounded-full px-4 py-2.5 text-sm font-semibold tracking-wide text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'var(--op-ink-dark)' }}
                      onMouseEnter={(e) => {
                        if (!product.inStock) return;
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'var(--op-brand)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'var(--op-ink-dark)';
                      }}
                      onClick={() =>
                        addItem({
                          productId: product.id,
                          name: product.name,
                          imageUrl: product.imageUrls[0] ?? '',
                          unitPrice: product.priceCents / 100,
                          quantity: 1,
                        })
                      }
                    >
                      {product.inStock ? 'AJOUTER' : 'RUPTURE'}
                    </button>
                  </div>
                </article>
              ))}
        </div>

        {!loading && items.length === 0 && !error && (
          <p
            className="py-16 text-center text-lg"
            style={{ color: 'var(--op-muted)' }}
          >
            Aucun produit pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
