import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  const { products = [] } = await getProducts();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="px-6 py-16 text-center">
        <h1 className="font-serif text-4xl font-light tracking-widest">LuxuryWatches Collection</h1>
        <p className="mt-2 text-xs tracking-[0.2em] uppercase text-gray-500">Premium luxury watches</p>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <a key={p.id} href={`/product/${p.handle}`} className="group">
              {p.thumbnail && (
                <div className="mb-4 aspect-[3/4] overflow-hidden bg-gray-900">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 text-sm font-light tracking-wide">{p.title}</h3>
              <p className="text-xs text-amber-400">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}