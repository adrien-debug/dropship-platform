import { getProducts } from '@/lib/medusa';
import { ShopGrid } from './shop/shop-grid';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { products } = await getProducts({ limit: 12 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-bold">Bienvenue</h1>
        <p className="mt-4 text-lg text-gray-600">Decouvrez nos produits</p>
        <a href="/shop" className="mt-6 inline-block rounded-full bg-black px-8 py-3 font-medium text-white hover:bg-gray-800">
          Voir la boutique
        </a>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Produits populaires</h2>
        <ShopGrid products={products} />
      </section>
    </div>
  );
}
