import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  const { products = [] } = await getProducts();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b px-6 py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">TestGeneral Store</h1>
        <p className="mt-2 text-sm text-gray-500">Browse our full general collection</p>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={`/product/${p.handle}`} className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md">
              {p.thumbnail && (
                <div className="mb-4 aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 truncate text-sm font-medium">{p.title}</h3>
              <p className="text-sm font-bold">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}