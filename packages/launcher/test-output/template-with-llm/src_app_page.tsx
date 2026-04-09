import { getProducts } from '@/lib/medusa';

export default async function HomePage() {
  const { products = [] } = await getProducts({ limit: 8 });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="relative bg-gradient-to-b from-amber-950/30 via-gray-950 to-gray-950 px-6 py-32 text-center">
        <h1 className="mb-4 font-serif text-6xl font-light tracking-widest lg:text-8xl">LuxuryWatches</h1>
        <p className="mx-auto mb-8 max-w-lg text-sm tracking-[0.3em] uppercase text-amber-200/60">Timeless elegance, crafted for you.</p>
        <a href="/shop" className="inline-block border border-amber-400/50 px-10 py-3 text-xs font-medium uppercase tracking-[0.3em] text-amber-200 transition hover:bg-amber-400/10">Discover</a>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-12 text-center text-xs font-medium uppercase tracking-[0.4em] text-amber-300/50">Curated Selection</h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="border-t border-gray-800/50 px-6 py-20 text-center">
        <h2 className="mb-4 text-sm uppercase tracking-[0.3em]">Exclusive Access</h2>
        <p className="mb-6 text-xs text-gray-500">Be the first to discover new arrivals and private sales</p>
        <form className="mx-auto flex max-w-sm gap-2">
          <input type="email" placeholder="your@email.com" className="flex-1 border-b border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-amber-400" />
          <button className="text-xs font-medium uppercase tracking-widest text-amber-400 transition hover:text-amber-300">Join</button>
        </form>
      </section>
    </div>
  );
}