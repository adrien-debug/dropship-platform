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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {images.map((img, i) => (
            <div key={img.id || i} className="aspect-square overflow-hidden rounded-2xl bg-gray-50">
              <img src={img.url} alt={product.title} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {product.categories?.[0] && (
            <a href={`/shop?category=${encodeURIComponent(product.categories[0].name)}`} className="text-sm text-gray-500 hover:underline">
              {product.categories[0].name}
            </a>
          )}
          <h1 className="text-3xl font-bold">{product.title}</h1>
          {price && (
            <p className="text-2xl font-bold">
              {(price.calculated_amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
            </p>
          )}
          {product.description && (
            <div className="prose mt-4 max-w-none text-gray-700">
              <p>{product.description}</p>
            </div>
          )}
          {variant && <AddToCartButton variantId={variant.id} />}
        </div>
      </div>
    </div>
  );
}
