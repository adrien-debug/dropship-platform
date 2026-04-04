import { getProducts } from '@/lib/medusa';
import { ShopGrid } from './shop/shop-grid';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { products } = await getProducts({ limit: 12 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-ds-xl">
      <section className="mb-ds-xl text-center">
        <h1 className="font-ds-display" style={{ fontWeight: 'var(--ds-weight-black, 900)', letterSpacing: '-2px' }}>
          Bienvenue
        </h1>
        <p className="mt-4 text-lg text-[var(--ds-text-muted)]">
          Decouvrez nos produits
        </p>
        <a
          href="/shop"
          className="ds-btn ds-btn-primary mt-6 inline-block"
        >
          Voir la boutique
        </a>
      </section>

      <section>
        <h2 className="mb-ds-lg font-bold" style={{ fontSize: 'var(--ds-size-h2)' }}>
          Produits populaires
        </h2>
        <ShopGrid products={products} />
      </section>
    </div>
  );
}
