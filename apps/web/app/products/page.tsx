import { listProducts, storefrontEnabled, type StoreProduct } from '@/lib/medusa-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { ProductCard } from '@/app/_components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  if (!storefrontEnabled()) {
    return (
      <StoreShell>
        <div className="max-w-3xl mx-auto p-12">
          <h1 className="text-2xl font-bold">Boutique indisponible</h1>
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
        <h1 className="text-3xl font-bold mb-8">Boutique</h1>
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded">{error}</div>
        )}
        {!error && products.length === 0 && (
          <p className="text-zinc-500">Aucun produit pour le moment.</p>
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
