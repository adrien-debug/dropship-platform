import { formatPriceUsd } from '@/lib/format-price';
import type { ProductDto } from '@/lib/product-types';

export function ProductInfo({ product }: { product: ProductDto }) {
  return (
    <div className="space-y-4">
      <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[var(--dashboard-text-muted)]">
        {product.category}
      </p>
      <h1 className="text-3xl font-semibold leading-tight text-[var(--dashboard-text-bright)] md:text-4xl">
        {product.name}
      </h1>
      <p className="text-2xl font-semibold text-[var(--dashboard-accent)] md:text-3xl">
        {formatPriceUsd(product.priceCents)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-[var(--dashboard-radius-badge)] px-3 py-1 text-xs font-medium font-[family-name:var(--font-mono)] ${
            product.inStock
              ? 'bg-[var(--dashboard-success-bg)] text-[var(--dashboard-success)] ring-1 ring-[var(--dashboard-success-border)]'
              : 'bg-[var(--dashboard-error-bg)] text-[var(--dashboard-error)] ring-1 ring-[var(--dashboard-error-border)]'
          }`}
        >
          {product.inStock ? 'In stock' : 'Out of stock'}
        </span>
      </div>
      {product.description.trim().length > 0 ? (
        <div className="border-t border-[var(--dashboard-border)] pt-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--dashboard-text-primary)]">Description</h2>
          <p className="whitespace-pre-wrap text-[var(--dashboard-text-secondary)] leading-relaxed">
            {product.description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
