import type { TemplateVars } from './index';

export function productGrid(vars: TemplateVars, cols = 4): string {
  const items = vars.products.slice(0, 8);
  return `
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Our Collection</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-${cols}">
          {products.map((p: any) => (
            <a key={p.id} href={\`/product/\${p.handle}\`} className="group rounded-xl border bg-white p-3 transition hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              {p.thumbnail && (
                <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  <img src={p.thumbnail} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                </div>
              )}
              <h3 className="mb-1 text-sm font-medium">{p.title}</h3>
              <p className="text-sm font-bold">{(p.variants?.[0]?.prices?.[0]?.amount ?? 0) / 100}€</p>
            </a>
          ))}
        </div>
      </section>`;
}

export function heroSection(vars: TemplateVars, bgClass: string, textClass: string): string {
  return `
      <section className="${bgClass} px-6 py-24 text-center">
        <h1 className="${textClass} mb-4 text-5xl font-black lg:text-7xl">${vars.brandName}</h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg opacity-80">${vars.tagline}</p>
        <a href="/shop" className="inline-block rounded-full bg-white px-8 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-200">
          Explore Collection
        </a>
      </section>`;
}

export function contactPage(vars: TemplateVars, bgClass: string, textClass: string): string {
  return `'use client';

export default function ContactPage() {
  return (
    <div className="${bgClass} min-h-screen ${textClass}">
      <section className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="mb-4 text-4xl font-bold">Contact ${vars.brandName}</h1>
        <p className="mb-8 opacity-70">Questions? We'd love to hear from you.</p>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <input type="text" placeholder="Name" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <input type="email" placeholder="Email" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <textarea placeholder="Message" rows={5} className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <button type="submit" className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-200">
            Send Message
          </button>
        </form>
      </section>
    </div>
  );
}`;
}

export function aboutPage(vars: TemplateVars, bgClass: string, textClass: string): string {
  return `export default function AboutPage() {
  return (
    <div className="${bgClass} min-h-screen ${textClass}">
      <section className="mx-auto max-w-4xl px-6 py-24">
        <h1 className="mb-6 text-5xl font-black">About ${vars.brandName}</h1>
        <div className="space-y-6 text-lg leading-relaxed opacity-80">
          <p>${vars.brandName} was born from a passion for ${vars.niche}. We curate only the finest products for enthusiasts who demand quality.</p>
          <p>Every item in our collection is hand-picked and tested. We work directly with manufacturers to ensure authenticity and fair pricing.</p>
          <p>Our mission: make premium ${vars.niche} products accessible to everyone, everywhere.</p>
        </div>
      </section>
      <section className="border-t border-gray-800 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8 text-center">
          <div><p className="text-3xl font-black">10K+</p><p className="text-sm opacity-60">Happy Customers</p></div>
          <div><p className="text-3xl font-black">500+</p><p className="text-sm opacity-60">Products</p></div>
          <div><p className="text-3xl font-black">24/7</p><p className="text-sm opacity-60">Support</p></div>
        </div>
      </section>
    </div>
  );
}`;
}
