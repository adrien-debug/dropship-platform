import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/store-config';
import { formatMoney, listProducts } from '@/lib/medusa-store';
import { breadcrumbList, organizationSchema, storeUrl, withCanonical } from '@/lib/seo';
import { TrackPageView } from '@/components/analytics/TrackPageView';
import { StoreLogo } from '@/components/ui';
import type { StoreTemplate } from '@/lib/store-config';
import { MonoProductLanding } from './MonoProductLanding';
import { CollectionEditorialLanding } from './CollectionEditorialLanding';
import { LuxuryMinimalLanding } from './LuxuryMinimalLanding';
import { GenZBoldLanding } from './GenZBoldLanding';
import { EditorialFashionLanding } from './EditorialFashionLanding';
import { WellnessSoftLanding } from './WellnessSoftLanding';
import { LuxuryMonoLanding } from './LuxuryMonoLanding';
import { WellnessSerenityLanding } from './WellnessSerenityLanding';
import { WellnessPulseLanding } from './WellnessPulseLanding';
import { WellnessDanceLanding } from './WellnessDanceLanding';
import { WellnessStudioLanding } from './WellnessStudioLanding';
import { WellnessRetreatLanding } from './WellnessRetreatLanding';
import { WellnessFitnessBlogLanding } from './WellnessFitnessBlogLanding';
import { WellnessMassageQuietLanding } from './WellnessMassageQuietLanding';
import { WellnessOnyxGymLanding } from './WellnessOnyxGymLanding';
import { EventsMusicartLanding } from './EventsMusicartLanding';
import { EventsBouquetLanding } from './EventsBouquetLanding';
import { EventsArcadiumLanding } from './EventsArcadiumLanding';
import { EventsSummitLanding } from './EventsSummitLanding';
import { EventsConvergeLanding } from './EventsConvergeLanding';
import { FashionBoutique1622Landing } from './FashionBoutique1622Landing';
import { BeautySalon2851Landing } from './BeautySalon2851Landing';
import { FioraLocksLanding } from './FioraLocksLanding';
import { AdventureTravel2787Landing } from './AdventureTravel2787Landing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  const description =
    store.description ||
    `Découvrez ${store.productCount} produit${store.productCount > 1 ? 's' : ''} ${store.niche} soigneusement sélectionnés.`;
  const ogImage = store.heroImageUrl || store.cutoutImageUrl || undefined;
  return withCanonical(
    {
      title: `${store.name} — ${store.tagline || store.niche}`,
      description,
      openGraph: {
        title: store.name,
        description: store.tagline || description,
        type: 'website',
        url: storeUrl(slug),
        siteName: store.name,
        images: ogImage ? [{ url: ogImage }] : [],
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title: store.name,
        description: store.tagline || description,
        images: ogImage ? [ogImage] : undefined,
      },
    },
    `/shop/${slug}`,
  );
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  let products: Awaited<ReturnType<typeof listProducts>>['products'] = [];
  let error: string | null = null;

  try {
    const result = await listProducts({ limit: 50, publishableKey: store.medusaPublishableKey });
    products = result.products;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur chargement produits';
  }

  const orgJsonLd = JSON.stringify(organizationSchema(store));
  const breadcrumbJsonLd = JSON.stringify(
    breadcrumbList([{ name: store.name, url: storeUrl(slug) }]),
  );

  // P1.4 — resolve the storefront template. `auto` (default) keeps the
  // legacy logic (1 product → mono, else grid). Operators can flip a
  // store to mono / collection-grid / collection-editorial from the
  // admin to overrule the heuristic.
  const resolved: StoreTemplate = resolveTemplate(store.template, products.length);

  const jsonLdHead = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
    </>
  );

  if (!error && resolved === 'mono' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView
          slug={slug}
          eventName="view_content"
          productId={products[0].id}
          variantId={products[0].variants?.[0]?.id}
        />
        <MonoProductLanding store={store} product={products[0]} />
      </>
    );
  }

  if (!error && resolved === 'collection-editorial' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <CollectionEditorialLanding store={store} products={products} />
      </>
    );
  }

  if (!error && resolved === 'luxury-minimal' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <LuxuryMinimalLanding store={store} products={products} />
      </>
    );
  }

  if (!error && resolved === 'gen-z-bold' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <GenZBoldLanding store={store} products={products} />
      </>
    );
  }

  if (!error && resolved === 'editorial-fashion' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <EditorialFashionLanding store={store} products={products} />
      </>
    );
  }

  if (!error && resolved === 'wellness-soft' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <WellnessSoftLanding store={store} products={products} />
      </>
    );
  }

  if (!error && resolved === 'luxury-mono' && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView
          slug={slug}
          eventName="view_content"
          productId={products[0].id}
          variantId={products[0].variants?.[0]?.id}
        />
        <LuxuryMonoLanding store={store} products={products} />
      </>
    );
  }

  // ============== Wix ingest batch — May 2026 ==============
  const ingested: Record<string, React.ComponentType<{ store: typeof store; products: typeof products }>> = {
    'wellness-serenity': WellnessSerenityLanding,
    'wellness-pulse': WellnessPulseLanding,
    'wellness-dance': WellnessDanceLanding,
    'wellness-studio': WellnessStudioLanding,
    'wellness-retreat': WellnessRetreatLanding,
    'wellness-fitness-blog': WellnessFitnessBlogLanding,
    'wellness-massage-quiet': WellnessMassageQuietLanding,
    'wellness-onyx-gym': WellnessOnyxGymLanding,
    'events-musicart': EventsMusicartLanding,
    'events-bouquet': EventsBouquetLanding,
    'events-arcadium': EventsArcadiumLanding,
    'events-summit': EventsSummitLanding,
    'events-converge': EventsConvergeLanding,
    'fashion-boutique-1622': FashionBoutique1622Landing,
    'beauty-salon-2851': BeautySalon2851Landing,
    'fiora-locks-wh1270': FioraLocksLanding,
    'adventure-travel-2787': AdventureTravel2787Landing,
  };

  const IngestedComponent = ingested[resolved];
  if (!error && IngestedComponent && products.length >= 1) {
    return (
      <>
        {jsonLdHead}
        <TrackPageView slug={slug} eventName="page_view" />
        <IngestedComponent store={store} products={products} />
      </>
    );
  }

  return (
    <div>
      {jsonLdHead}
      <TrackPageView slug={slug} eventName="page_view" />
      {/* Hero */}
      <section
        className="text-white py-20 text-center"
        style={{ backgroundColor: store.primaryColor }}
      >
        <div className="max-w-3xl mx-auto px-4">
          <div className="inline-flex mb-5"><StoreLogo emoji={store.logoEmoji} size={56} strokeWidth={1.25} /></div>
          <h1 className="text-4xl font-bold mb-3">{store.name}</h1>
          {store.tagline && <p className="text-xl opacity-90 mb-2">{store.tagline}</p>}
          {store.description && (
            <p className="text-sm opacity-70 max-w-lg mx-auto">{store.description}</p>
          )}
          <div
            className="inline-block mt-6 px-6 py-2 rounded-full text-sm font-medium"
            style={{ backgroundColor: store.accentColor }}
          >
            {store.productCount} produits disponibles
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold mb-8 text-zinc-900">Nos produits</h2>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded mb-6">{error}</div>
        )}

        {!error && products.length === 0 && (
          <p className="text-zinc-500 text-center py-20">Aucun produit disponible pour le moment.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const imageUrl = product.thumbnail || product.images?.[0]?.url;

            return (
              <Link
                key={product.id}
                href={`/shop/${slug}/products/${product.handle}`}
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-zinc-100"
              >
                <div className="aspect-square overflow-hidden bg-zinc-100">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      <StoreLogo emoji={store.logoEmoji} size={40} strokeWidth={1.25} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-zinc-900 text-sm line-clamp-2 mb-2">
                    {product.title}
                  </h3>
                  {price !== undefined && (
                    <div className="font-bold text-lg" style={{ color: store.accentColor }}>
                      {formatMoney(price, variant?.calculated_price?.currency_code || 'eur')}
                    </div>
                  )}
                  <div
                    className="mt-3 w-full text-center text-sm py-2 rounded-lg text-white font-medium transition-opacity group-hover:opacity-90"
                    style={{ backgroundColor: store.primaryColor }}
                  >
                    Voir le produit
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function resolveTemplate(template: StoreTemplate, productCount: number): StoreTemplate {
  if (template !== 'auto') return template;
  if (productCount === 1) return 'mono';
  return 'collection-grid';
}
