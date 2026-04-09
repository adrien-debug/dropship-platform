import { getProducts } from '@/lib/medusa';

export default async function HomePage() {
  const { products = [] } = await getProducts({ limit: 8 });

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="bg-gray-950 px-6 py-28 text-center text-white">
        <h1 className="mb-4 text-5xl font-bold tracking-tight lg:text-7xl">TestGeneral</h1>
        <p className="mx-auto mb-8 max-w-lg text-lg text-gray-300">Premium general products</p>
        <a href="/shop" className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-100">Shop Now</a>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold">Featured Products</h2>
        <p className="mb-10 text-center text-sm text-gray-500">Curated general essentials</p>
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

      <section className="bg-gray-950 px-6 py-16 text-center text-white">
        <h2 className="mb-4 text-xl font-bold">Newsletter</h2>
        <p className="mb-6 text-sm text-gray-400">New arrivals and special offers</p>
        <form className="mx-auto flex max-w-md gap-2">
          <input type="email" placeholder="your@email.com" className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white outline-none focus:border-white" />
          <button className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-100">Subscribe</button>
        </form>
      </section>
    </div>
  );
}