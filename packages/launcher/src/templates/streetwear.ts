import type { SiteTemplate, TemplateVars } from './index';
import { aboutPage, contactPage } from './shared';

function homePage(v: TemplateVars): string {
  return `import { getProducts } from '@/lib/medusa';

export default async function HomePage() {
  const { products = [] } = await getProducts({ limit: 8 });

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden bg-black px-6 py-28 text-center">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]" />
        <div className="relative">
          <h1 className="mb-4 text-7xl font-black uppercase tracking-tighter lg:text-9xl">${v.brandName}</h1>
          <p className="mb-8 text-sm font-medium uppercase tracking-[0.5em] text-gray-400">${v.tagline}</p>
          <a href="/shop" className="inline-block bg-white px-10 py-3 text-sm font-black uppercase text-black transition hover:bg-gray-200">Shop Drops</a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-10 text-xl font-black uppercase tracking-widest">Latest Drops</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={\`/product/\${p.handle}\`} className="group border border-gray-800 p-3 transition hover:border-white">
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

      <section className="border-t border-gray-800 px-6 py-16 text-center">
        <h2 className="mb-4 text-sm font-black uppercase tracking-[0.5em]">Stay in the loop</h2>
        <form className="mx-auto flex max-w-md gap-2">
          <input type="email" placeholder="email@address.com" className="flex-1 border border-gray-800 bg-transparent px-4 py-3 text-sm outline-none focus:border-white" />
          <button className="bg-white px-6 py-3 text-sm font-black uppercase text-black transition hover:bg-gray-200">Join</button>
        </form>
      </section>
    </div>
  );
}`;
}

function shopPage(v: TemplateVars): string {
  return `import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  const { products = [] } = await getProducts();

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="border-b border-gray-800 px-6 py-12">
        <h1 className="text-4xl font-black uppercase tracking-tighter">${v.brandName} Store</h1>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={\`/product/\${p.handle}\`} className="group border border-gray-800 p-3 transition hover:border-white">
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
}`;
}

export const streetwearTemplate: SiteTemplate = {
  id: 'streetwear',
  name: 'Streetwear',
  niches: ['streetwear', 'fashion', 'clothing', 'mode', 'vetements', 'sneakers', 'urban', 'hype'],
  designSystem: 'radical',
  pages: {
    '/': homePage,
    '/shop': shopPage,
    '/about': (v) => aboutPage(v, 'bg-black', 'text-white'),
    '/contact': (v) => contactPage(v, 'bg-black', 'text-white'),
  },
};
