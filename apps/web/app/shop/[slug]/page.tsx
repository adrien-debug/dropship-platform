import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getStoreBySlug } from '@/lib/store-config';
import { listProducts } from '@/lib/medusa-store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: `${store.name} — ${store.tagline || store.niche}`,
    description: store.description || `Découvrez ${store.productCount} produits ${store.niche} soigneusement sélectionnés.`,
    openGraph: {
      title: store.name,
      description: store.tagline || store.description || '',
      type: 'website',
    },
  };
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

  return (
    <div>
      {/* Hero */}
      <section
        className="text-white py-20 text-center"
        style={{ backgroundColor: store.primaryColor }}
      >
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-6xl mb-4">{store.logoEmoji}</div>
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
        <h2 className="text-2xl font-bold mb-8 text-gray-900">Nos produits</h2>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded mb-6">{error}</div>
        )}

        {!error && products.length === 0 && (
          <p className="text-gray-500 text-center py-20">Aucun produit disponible pour le moment.</p>
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
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {store.logoEmoji}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                    {product.title}
                  </h3>
                  {price !== undefined && (
                    <div className="font-bold text-lg" style={{ color: store.accentColor }}>
                      {(price / 100).toFixed(2)} €
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
