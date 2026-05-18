import Link from 'next/link';
import { formatMoney, type StoreProduct } from '@/lib/medusa-store';

export function ProductCard({ product }: { product: StoreProduct }) {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price;
  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div
        className="aspect-square rounded-lg overflow-hidden"
        style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
      >
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : null}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3
          className="text-sm font-medium line-clamp-2"
          style={{ color: 'var(--ct-text-primary, rgba(245,245,245,0.92))' }}
        >
          {product.title}
        </h3>
        {price ? (
          <span
            className="text-sm whitespace-nowrap"
            style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
          >
            {formatMoney(price.calculated_amount, price.currency_code)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
