import { listProducts, storefrontEnabled, type StoreProduct } from '@/lib/medusa-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { ProductCard } from '@/app/_components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
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
  let products: StoreProduct[] = [];
  let error: string | null = null;
  try {
    const r = await listProducts({ limit: 50 });
    products = r.products;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }
  return (
    <StoreShell>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="ct-title mb-8">
          Boutique
        </h1>
        {error && (
          <div
            className="border p-4 rounded mb-6 text-sm"
            style={{
              borderColor: 'var(--ct-border-accent)',
              backgroundColor: 'var(--ct-accent-soft)',
              color: 'var(--ct-accent-strong)',
            }}
          >
            {error}
          </div>
        )}
        {!error && products.length === 0 && (
          <p style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}>
            Aucun produit pour le moment.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
