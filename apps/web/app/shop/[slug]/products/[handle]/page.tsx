import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/store-config';
import { formatMoney, getProduct } from '@/lib/medusa-store';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import { breadcrumbList, productSchema, productUrl, storeUrl, withCanonical } from '@/lib/seo';
import { TrackPageView } from '@/components/analytics/TrackPageView';

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
  const image = product.thumbnail || product.images?.[0]?.url || undefined;
  const description = product.description?.slice(0, 200) || `${product.title} disponible chez ${store.name}.`;
  return withCanonical(
    {
      title: `${product.title} — ${store.name}`,
      description: description.slice(0, 160),
      openGraph: {
        title: product.title,
        description,
        url: productUrl(slug, handle),
        siteName: store.name,
        images: image ? [{ url: image }] : [],
        type: 'website',
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: product.title,
        description,
        images: image ? [image] : undefined,
      },
    },
    `/shop/${slug}/products/${handle}`,
  );
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
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const imageUrl = product.thumbnail || product.images?.[0]?.url;

  const productJsonLd = JSON.stringify(
    productSchema({
      storeSlug: slug,
      storeName: store.name,
      productTitle: product.title,
      productDescription: product.description,
      productHandle: product.handle,
      imageUrl,
      priceMinor: price,
      currency,
    }),
  );
  const breadcrumbJsonLd = JSON.stringify(
    breadcrumbList([
      { name: store.name, url: storeUrl(slug) },
      { name: product.title, url: productUrl(slug, product.handle) },
    ]),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <TrackPageView
        slug={slug}
        eventName="view_content"
        productId={product.id}
        variantId={variant?.id}
      />
      <nav className="mb-8 text-sm text-zinc-500">
        <Link href={`/shop/${slug}`} className="hover:underline" style={{ color: store.accentColor }}>
          {store.logoEmoji} {store.name}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-zinc-900">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image */}
        <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-100 shadow-md">
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
          <h1 className="text-3xl font-bold text-zinc-900 mb-4">{product.title}</h1>

          {price !== undefined && (
            <div className="text-4xl font-bold mb-6" style={{ color: store.accentColor }}>
              {formatMoney(price, variant?.calculated_price?.currency_code || 'eur')}
            </div>
          )}

          {product.description && (
            <div className="prose prose-sm text-zinc-600 mb-8 leading-relaxed">
              {product.description}
            </div>
          )}

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span>✅</span>
              <span>Livraison internationale disponible</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span>🔒</span>
              <span>Paiement 100% sécurisé</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span>↩️</span>
              <span>Retours faciles sous 30 jours</span>
            </div>
          </div>

          {variant && (
            <AddToCartButton variantId={variant.id} storeSlug={slug} showQuantity />
          )}

          <p className="text-xs text-zinc-400 mt-4 text-center">
            Article ajouté au panier global — checkout sécurisé par Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
