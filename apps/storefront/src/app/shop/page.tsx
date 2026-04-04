import { getProducts } from '@/lib/products';
import { ProductGrid } from '@dropship/ui';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const { products, total } = await getProducts({ limit: 24 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Boutique</h1>
      <p className="mb-6 text-sm text-gray-500">{total} produits</p>
      <ProductGrid items={products} />
    </div>
  );
}
