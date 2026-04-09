import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  const { products = [] } = await getProducts();

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="border-b border-gray-800 px-6 py-12">
        <h1 className="text-4xl font-black uppercase tracking-tighter">TestStreetwear Store</h1>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={`/product/${p.handle}`} className="group border border-gray-800 p-3 transition hover:border-white">
              {p.thumbnail && (
                <div className="mb-3 aspect-square overflow-hidden bg-gray-900">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 truncate text-xs font-bold uppercase tracking-wide">{p.title}</h3>
              <p className="text-sm font-black">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}