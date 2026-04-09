import { getProducts } from '@/lib/medusa';

export default async function HomePage() {
  const { products = [] } = await getProducts({ limit: 8 });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-gray-950 to-cyan-950 px-6 py-28 text-center">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at 30% 50%, #0ea5e9 0%, transparent 50%)'}} />
        <div className="relative">
          <h1 className="mb-4 text-6xl font-black tracking-tight lg:text-8xl">TestTech</h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-blue-200/70">Premium tech products</p>
          <a href="/shop" className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-bold transition hover:bg-blue-700">Browse Tech</a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold">Featured Gear</h2>
        <p className="mb-10 text-center text-sm text-gray-500">Top-rated tech products</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={`/product/${p.handle}`} className="group rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">
              {p.thumbnail && (
                <div className="mb-4 aspect-square overflow-hidden rounded-lg bg-gray-800">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 truncate text-sm font-medium">{p.title}</h3>
              <p className="text-sm font-bold text-blue-400">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-800 px-6 py-16 text-center">
        <h2 className="mb-4 text-xl font-bold">Tech Newsletter</h2>
        <p className="mb-6 text-sm text-gray-500">New drops, reviews, and deals</p>
        <form className="mx-auto flex max-w-md gap-2">
          <input type="email" placeholder="your@email.com" className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm outline-none focus:border-blue-500" />
          <button className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-700">Join</button>
        </form>
      </section>
    </div>
  );
}