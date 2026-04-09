import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  const { products = [] } = await getProducts();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="border-b border-gray-800 px-6 py-12 text-center">
        <h1 className="text-4xl font-black">Shop AnimeStore</h1>
        <p className="mt-2 text-sm text-gray-400">Browse our full anime collection</p>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={`/product/${p.handle}`} className="group rounded-xl border border-gray-800 bg-gray-900 p-3 transition hover:border-purple-500">
              {p.thumbnail && (
                <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-800">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 truncate text-sm font-medium">{p.title}</h3>
              <p className="text-sm font-bold text-purple-400">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}