import Image from 'next/image';
import Link from 'next/link';
import { formatPriceUsd } from '@/lib/format-price';
import type { ProductDto } from '@/lib/product-types';

export function RelatedProducts({ products }: { products: ProductDto[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-[var(--dashboard-border)] pt-12" aria-labelledby="related-heading">
      <h2
        id="related-heading"
        className="mb-8 text-xl font-semibold text-[var(--dashboard-text-bright)] font-[family-name:var(--font-mono)]"
      >
        Related Products
      </h2>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map(p => (
          <li key={p.id}>
            <Link
              href={`/shop/${p.id}`}
              className="group block overflow-hidden rounded-[var(--dashboard-radius-card)] border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] transition-[border-color,box-shadow] hover:border-[var(--dashboard-border-mid)]"
              style={{ boxShadow: 'var(--dashboard-shadow-sm)' }}
            >
              <div className="relative aspect-square w-full bg-[var(--dashboard-card-2)]">
                {p.imageUrls.length > 0 ? (
                  <Image
                    src={p.imageUrls[0]}
                    alt={p.name}
                    fill
                    className="object-contain p-3 transition-transform group-hover:scale-[1.02]"
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-[var(--dashboard-text-ghost)]">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="line-clamp-2 font-medium text-[var(--dashboard-text-primary)] group-hover:text-[var(--dashboard-accent)]">
                  {p.name}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[var(--dashboard-accent)]">
                  {formatPriceUsd(p.priceCents)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
