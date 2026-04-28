import Link from 'next/link';
import { listProducts, storefrontEnabled, type StoreProduct } from '@/lib/medusa-store';
import { StoreShell } from './_components/StoreShell';
import { ProductCard } from './_components/ProductCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  if (!storefrontEnabled()) {
    return (
      <StoreShell>
        <div className="max-w-3xl mx-auto p-12">
          <h1 className="text-3xl font-bold">Storefront indisponible</h1>
          <p className="mt-3 text-zinc-600">
            Configurer <code>MEDUSA_URL</code> et <code>NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY</code> dans Vercel.
          </p>
        </div>
      </StoreShell>
    );
  }

  let products: StoreProduct[] = [];
  let error: string | null = null;
  try {
    const { products: p } = await listProducts({ limit: 12 });
    products = p;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur inconnue';
  }

  return (
    <StoreShell>
      <Hero />
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-2xl font-semibold">Notre sélection</h2>
          <Link href="/products" className="text-sm underline text-zinc-700">
            Tout voir →
          </Link>
        </div>
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded">
            <p className="font-medium">Impossible de charger les produits</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
        {!error && products.length === 0 && (
          <p className="text-zinc-500">Aucun produit publié pour le moment.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}

function Hero() {
  return (
    <section className="border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Objets choisis, livrés en Europe.</h1>
        <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">
          Une sélection minimaliste de pièces design, sourcées et expédiées sans friction.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:bg-zinc-800"
        >
          Voir la sélection
        </Link>
      </div>
    </section>
  );
}

