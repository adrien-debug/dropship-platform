import { getProductByHandle } from '@/lib/medusa';
import { notFound } from 'next/navigation';
import { AddToCartButton } from './add-to-cart';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  const variant = product.variants[0];
  const price = variant?.calculated_price;
  const images = product.images?.length ? product.images : product.thumbnail ? [{ id: '0', url: product.thumbnail }] : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-ds-xl">
      <div className="grid gap-ds-lg lg:grid-cols-2">
        <div className="space-y-ds-md">
          {images.map((img, i) => (
            <div key={img.id || i} className="ds-card aspect-square overflow-hidden">
              <img src={img.url} alt={product.title} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-ds-md">
          {product.categories?.[0] && (
            <a href={`/shop?category=${encodeURIComponent(product.categories[0].name)}`} className="text-sm text-[var(--ds-text-muted)] hover:text-[var(--ds-accent)]">
              {product.categories[0].name}
            </a>
          )}
          <h1 style={{ fontSize: 'var(--ds-size-h2)', fontWeight: 'var(--ds-weight-black, 900)' }}>
            {product.title}
          </h1>
          {price && (
            <p className="text-2xl" style={{ fontWeight: 'var(--ds-weight-black, 900)', color: 'var(--ds-accent)' }}>
              {(price.calculated_amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
            </p>
          )}
          {product.description && (
            <div className="mt-ds-md text-[var(--ds-text-secondary)]">
              <p>{product.description}</p>
            </div>
          )}
          {variant && <AddToCartButton variantId={variant.id} />}
        </div>
      </div>
    </div>
  );
}
