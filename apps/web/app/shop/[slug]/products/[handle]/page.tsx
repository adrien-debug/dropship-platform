import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/store-config';
import { getProduct } from '@/lib/medusa-store';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; handle: string }>;
}): Promise<Metadata> {
  const { slug, handle } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  const product = await getProduct(handle, store.medusaPublishableKey).catch(() => null);
  if (!product) return { title: store.name };
  return {
    title: `${product.title} — ${store.name}`,
    description: product.description?.slice(0, 160) || '',
    openGraph: {
      title: product.title,
      description: product.description?.slice(0, 200) || '',
      images: product.thumbnail ? [{ url: product.thumbnail }] : [],
      type: 'website',
    },
  };
}

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ slug: string; handle: string }>;
}) {
  const { slug, handle } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  let product: Awaited<ReturnType<typeof getProduct>> | null = null;
  try {
    product = await getProduct(handle, store.medusaPublishableKey);
  } catch {
    notFound();
  }
  if (!product) notFound();

  const variant = product.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const imageUrl = product.thumbnail || product.images?.[0]?.url;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <nav className="mb-8 text-sm text-gray-500">
        <Link href={`/shop/${slug}`} className="hover:underline" style={{ color: store.accentColor }}>
          {store.logoEmoji} {store.name}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image */}
        <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-md">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl">
              {store.logoEmoji}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.title}</h1>

          {price !== undefined && (
            <div className="text-4xl font-bold mb-6" style={{ color: store.accentColor }}>
              {(price / 100).toFixed(2)} €
            </div>
          )}

          {product.description && (
            <div className="prose prose-sm text-gray-600 mb-8 leading-relaxed">
              {product.description}
            </div>
          )}

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>✅</span>
              <span>Livraison internationale disponible</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🔒</span>
              <span>Paiement 100% sécurisé</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>↩️</span>
              <span>Retours faciles sous 30 jours</span>
            </div>
          </div>

          {variant && (
            <AddToCartButton variantId={variant.id} />
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Article ajouté au panier global — checkout sécurisé par Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
