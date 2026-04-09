import type { SiteTemplate, TemplateVars } from './index';
import { aboutPage, contactPage } from './shared';

function homePage(v: TemplateVars): string {
  return `import { getProducts } from '@/lib/medusa';

export default async function HomePage() {
  const { products = [] } = await getProducts({ limit: 8 });

  return (
    <div className="min-h-screen bg-rose-50 text-gray-900">
      <section className="bg-gradient-to-b from-rose-100 via-rose-50 to-white px-6 py-28 text-center">
        <h1 className="mb-4 font-serif text-5xl font-light text-rose-900 lg:text-7xl">${v.brandName}</h1>
        <p className="mx-auto mb-8 max-w-lg text-lg text-rose-700/70">${v.tagline}</p>
        <a href="/shop" className="inline-block rounded-full bg-rose-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-rose-700">Shop Skincare</a>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-2 text-center text-2xl font-light text-rose-900">Bestsellers</h2>
        <p className="mb-10 text-center text-sm text-rose-400">Loved by thousands</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={\`/product/\${p.handle}\`} className="group rounded-2xl border border-rose-100 bg-white p-4 shadow-sm transition hover:shadow-md">
              {p.thumbnail && (
                <div className="mb-4 aspect-square overflow-hidden rounded-xl bg-rose-50">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 text-sm font-medium text-rose-900">{p.title}</h3>
              <p className="text-sm font-bold text-rose-600">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>

      <section className="bg-rose-900 px-6 py-16 text-center text-white">
        <h2 className="mb-4 text-2xl font-light">Stay Beautiful</h2>
        <p className="mb-6 text-sm text-rose-200">Tips, new arrivals and exclusive offers</p>
        <form className="mx-auto flex max-w-md gap-2">
          <input type="email" placeholder="your@email.com" className="flex-1 rounded-full border border-rose-700 bg-rose-800/50 px-4 py-3 text-sm outline-none placeholder:text-rose-300 focus:border-white" />
          <button className="rounded-full bg-white px-6 py-3 text-sm font-medium text-rose-900 transition hover:bg-rose-50">Subscribe</button>
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
    <div className="min-h-screen bg-rose-50 text-gray-900">
      <section className="px-6 py-12 text-center">
        <h1 className="font-serif text-4xl font-light text-rose-900">${v.brandName} Collection</h1>
        <p className="mt-2 text-sm text-rose-400">Premium ${v.niche} products</p>
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p: any) => (
            <a key={p.id} href={\`/product/\${p.handle}\`} className="group rounded-2xl border border-rose-100 bg-white p-4 shadow-sm transition hover:shadow-md">
              {p.thumbnail && (
                <div className="mb-4 aspect-square overflow-hidden rounded-xl bg-rose-50">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 text-sm font-medium text-rose-900">{p.title}</h3>
              <p className="text-sm font-bold text-rose-600">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}`;
}

export const beautyTemplate: SiteTemplate = {
  id: 'beauty',
  name: 'Beauty / Skincare',
  niches: ['beauty', 'skincare', 'cosmetics', 'cosmetique', 'makeup', 'wellness', 'spa'],
  designSystem: 'ds-08-pastel-bloom',
  pages: {
    '/': homePage,
    '/shop': shopPage,
    '/about': (v) => aboutPage(v, 'bg-rose-50', 'text-rose-900'),
    '/contact': (v) => contactPage(v, 'bg-rose-50', 'text-rose-900'),
  },
};
