import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getProductByHandle, formatMoney, storefrontEnabled } from '@/lib/medusa-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { AddToCartButton } from './AddToCartButton';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  if (!storefrontEnabled()) {
    return (
      <StoreShell>
        <div className="max-w-3xl mx-auto p-12">
          <h1 className="ct-title">
            Boutique indisponible
          </h1>
        </div>
      </StoreShell>
    );
  }
  const { handle } = await params;
  const product = await getProductByHandle(handle).catch(() => null);
  if (!product) notFound();

  const variant = product.variants?.[0];
  const price = variant?.calculated_price;
  const images = product.images && product.images.length > 0 ? product.images : product.thumbnail ? [{ url: product.thumbnail }] : [];

  return (
    <StoreShell>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-lg overflow-hidden"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            >
              <Image
                src={img.url}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority={idx === 0}
              />
            </div>
          ))}
        </div>
        <div>
          <h1 className="ct-title">
            {product.title}
          </h1>
          {price && (
            <p
              className="mt-3 text-2xl"
              style={{ color: 'var(--ct-text-primary, rgba(245,245,245,0.92))' }}
            >
              {formatMoney(price.calculated_amount, price.currency_code)}
            </p>
          )}
          {product.description && (
            <div
              className="mt-6 whitespace-pre-line"
              style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
            >
              {product.description}
            </div>
          )}
          {variant ? (
            <div className="mt-8">
              <AddToCartButton variantId={variant.id} showQuantity />
            </div>
          ) : (
            <p
              className="mt-6 text-sm"
              style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
            >
              Aucune variante disponible.
            </p>
          )}
        </div>
      </section>
    </StoreShell>
  );
}
