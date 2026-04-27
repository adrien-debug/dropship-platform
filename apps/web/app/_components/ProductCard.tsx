import Link from 'next/link';
import { formatMoney, type StoreProduct } from '@/lib/medusa-store';

export function ProductCard({ product }: { product: StoreProduct }) {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price;
  return (
    <Link href={`/products/${product.handle}`} className="group block">
      <div className="aspect-square bg-zinc-100 rounded-lg overflow-hidden">
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
        <h3 className="text-sm font-medium line-clamp-2">{product.title}</h3>
        {price ? (
          <span className="text-sm whitespace-nowrap">{formatMoney(price.calculated_amount, price.currency_code)}</span>
        ) : null}
      </div>
    </Link>
  );
}
