import { getProducts } from '@/lib/medusa';
import { ShopGrid } from './shop/shop-grid';
import { getSiteConfig, getSiteContent } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [{ products }, siteConfig] = await Promise.all([
    getProducts({ limit: 12 }),
    getSiteConfig().catch(() => null),
  ]);

  const content = siteConfig ? getSiteContent(siteConfig as Record<string, unknown>) : null;
  const heroTitle = content?.hero_title || 'Welcome';
  const heroSubtitle = content?.hero_subtitle || 'Discover our products';
  const heroCta = content?.hero_cta || 'Shop Now';

  return (
    <div className="mx-auto max-w-7xl px-4 py-ds-xl">
      <section className="mb-ds-xl text-center">
        <h1 className="font-ds-display" style={{ fontWeight: 'var(--ds-weight-black, 900)', letterSpacing: '-2px' }}>
          {heroTitle}
        </h1>
        <p className="mt-4 text-lg text-[var(--ds-text-muted)]">
          {heroSubtitle}
        </p>
        <a
          href="/shop"
          className="ds-btn ds-btn-primary mt-6 inline-block"
        >
          {heroCta}
        </a>
      </section>

      <section>
        <h2 className="mb-ds-lg font-bold" style={{ fontSize: 'var(--ds-size-h2)' }}>
          Popular Products
        </h2>
        <ShopGrid products={products} />
      </section>
    </div>
  );
}
