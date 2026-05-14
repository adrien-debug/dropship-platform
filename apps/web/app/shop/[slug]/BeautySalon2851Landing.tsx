import Link from 'next/link';
import { Playfair_Display, Inter } from 'next/font/google';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import { formatMoney } from '@/lib/medusa-store';
import type { StoreConfig } from '@/lib/store-config';

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: { calculated_amount: number; original_amount?: number; currency_code: string } | null;
}

export interface BeautySalon2851Product {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  thumbnail?: string | null;
  images?: MedusaImage[] | null;
  variants?: MedusaVariant[] | null;
}

interface Props {
  store: StoreConfig;
  products: BeautySalon2851Product[];
}

/**
 * Beauty Salon 2851 Landing — port of the Wix "Coupe et Style" hair salon
 * template (https://www.wix.com/templatesfr/2851-beauty-salon-s).
 *
 * Design grammar lifted from the source:
 *   - Champagne / sand hero background (#E5D9C0) with a model portrait on
 *     the left and a Playfair Display ExtraLight headline at 52px on the
 *     right ("Êtes-vous prête à changer de tête ?").
 *   - A dark band (#212121) immediately after the hero with three service
 *     tiles laid out edge-to-edge — each tile carries a square photo,
 *     a centred 22px label, and a paragraph of helper text in white.
 *   - "Nos services les plus populaires" section in 60px serif with a
 *     model photo + a single service card (title, duration, price,
 *     "Réserver" button) — we re-purpose it as a feature product hook.
 *   - A horizontal triptych ("Le meilleur salon") split by a centred dark
 *     plate carrying a giant quotation mark — testimonial layout.
 *   - "Meilleurs looks et produits" — 3-image lifestyle grid with a small
 *     hashtag kicker (#CoupeEtStyle).
 *   - Dark footer (#212121) with brand wordmark in serif + contact info +
 *     legal links.
 */

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bs2851-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-bs2851-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    champagne: '#E5D9C0', // hero band + testimonial band
    sand: '#EDE3CC', // softer cream variant
    dark: '#212121', // header bar + services band + footer
    ink: '#212121',
    muted: '#6B6B6B',
    line: '#D9D2C2',
  },
} as const;

export function BeautySalon2851Landing({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.champagne;
  const ink = theme.colors.ink;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const heroTitle = pickHeroTitle(store);
  const heroLede = pickHeroLede(store);

  const serviceTiles = buildServiceTiles(store, products);

  const featuredProduct = products[0];
  const lookProducts = products.slice(1, 4); // 3-image bottom grid

  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-bs2851-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — thin top bar ============== */}
      <header
        className="relative z-10 border-b"
        style={{
          backgroundColor: theme.colors.bg,
          borderColor: theme.colors.line,
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-10 h-16 flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="flex items-baseline gap-3"
          >
            <span
              style={{
                fontFamily: 'var(--font-bs2851-display), "Playfair Display", serif',
                color: ink,
                fontSize: '20px',
                fontWeight: 400,
              }}
            >
              {store.name}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-light">
            <span style={{ color: ink }}>Accueil</span>
            <span style={{ color: theme.colors.muted }}>À propos</span>
            <span style={{ color: theme.colors.muted }}>Services</span>
            <span style={{ color: theme.colors.muted }}>Contact</span>
          </nav>
          <span className="hidden md:inline text-sm font-light" style={{ color: theme.colors.muted }}>
            Panier (0)
          </span>
        </div>
      </header>

      {/* ============== HERO — champagne band, portrait + serif ============== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: theme.colors.champagne }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[640px]">
          <div className="relative min-h-[360px] md:min-h-[640px]">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={store.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-7xl"
                style={{
                  backgroundColor: theme.colors.sand,
                  color: theme.colors.muted,
                }}
                aria-hidden
              >
                {store.logoEmoji || '◐'}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center px-8 sm:px-16 py-16 md:py-24">
            <h1
              className="leading-[1.1] mb-8"
              style={{
                fontFamily: 'var(--font-bs2851-display), "Playfair Display", serif',
                color: ink,
                fontSize: 'clamp(2.2rem, 4.6vw, 3.5rem)',
                fontWeight: 400,
              }}
            >
              {heroTitle}
            </h1>
            {heroLede && (
              <p
                className="text-base font-light leading-[1.85] mb-10 max-w-md"
                style={{ color: theme.colors.muted }}
              >
                {heroLede}
              </p>
            )}
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-block w-fit px-10 py-4 text-sm font-light transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: ink,
                  color: '#FFFFFF',
                  letterSpacing: '0.14em',
                }}
              >
                Découvrir
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============== SERVICES BAND — dark, 3 tiles ============== */}
      {serviceTiles.length > 0 && (
        <section
          className="px-6 sm:px-10 py-20"
          style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
        >
          <ul className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {serviceTiles.map((tile, idx) => (
              <li key={idx} className="text-center">
                {tile.image ? (
                  <div className="relative aspect-[4/3] overflow-hidden mb-7">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tile.image}
                      alt={tile.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/3] mb-7 flex items-center justify-center text-5xl"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                    aria-hidden
                  >
                    {tile.icon}
                  </div>
                )}
                <h3
                  className="mb-3"
                  style={{
                    fontFamily: 'var(--font-bs2851-display), serif',
                    color: '#FFFFFF',
                    fontSize: '22px',
                    fontWeight: 400,
                  }}
                >
                  {tile.title}
                </h3>
                <p
                  className="text-sm font-light leading-[1.75] max-w-[280px] mx-auto"
                  style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  {tile.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="text-center mt-14">
            <Link
              href={`/shop/${store.slug}`}
              className="inline-block px-10 py-3.5 text-sm font-light transition-colors hover:bg-white/10"
              style={{
                backgroundColor: '#FFFFFF',
                color: ink,
                letterSpacing: '0.14em',
              }}
            >
              Voir les services
            </Link>
          </div>
        </section>
      )}

      {/* ============== SIGNATURE PRODUCT — "Nos services les plus populaires" === */}
      {featuredProduct && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto">
          <h2
            className="leading-[1.1] mb-14"
            style={{
              fontFamily: 'var(--font-bs2851-display), serif',
              color: ink,
              fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
              fontWeight: 400,
            }}
          >
            {pickServiceKicker(store)}
            <br />
            <span style={{ color: theme.colors.muted }}>{pickServiceTagline(store)}</span>
          </h2>

          <article
            className="grid grid-cols-1 md:grid-cols-2 border"
            style={{ borderColor: theme.colors.line }}
          >
            <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[380px]">
              {featuredProduct.thumbnail || featuredProduct.images?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featuredProduct.thumbnail || featuredProduct.images?.[0]?.url || ''}
                  alt={featuredProduct.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{
                    backgroundColor: theme.colors.sand,
                    color: theme.colors.muted,
                  }}
                  aria-hidden
                >
                  {store.logoEmoji || '◐'}
                </div>
              )}
            </div>
            <div className="px-8 py-10 flex flex-col justify-center">
              <h3
                className="mb-3"
                style={{
                  fontFamily: 'var(--font-bs2851-display), serif',
                  color: ink,
                  fontSize: '24px',
                  fontWeight: 400,
                }}
              >
                {featuredProduct.title}
              </h3>
              {featuredProduct.description && (
                <p
                  className="text-sm font-light leading-[1.85] mb-6"
                  style={{ color: theme.colors.muted }}
                >
                  {truncate(featuredProduct.description, 180)}
                </p>
              )}
              {(() => {
                const variant = featuredProduct.variants?.[0];
                const price = variant?.calculated_price?.calculated_amount;
                const currency = variant?.calculated_price?.currency_code || 'eur';
                return price !== undefined ? (
                  <p
                    className="mb-7 tabular-nums"
                    style={{
                      fontFamily: 'var(--font-bs2851-display), serif',
                      color: ink,
                      fontSize: '20px',
                    }}
                  >
                    {formatMoney(price, currency)}
                  </p>
                ) : null;
              })()}
              {featuredProduct.variants?.[0] && (
                <div className="max-w-xs">
                  <AddToCartButton
                    variantId={featuredProduct.variants[0].id}
                    storeSlug={store.slug}
                  />
                </div>
              )}
            </div>
          </article>
        </section>
      )}

      {/* ============== TESTIMONIAL — triptych with dark quote plate ========= */}
      <section
        className="px-6 sm:px-10 py-24"
        style={{ backgroundColor: theme.colors.champagne }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 items-center">
          <div className="text-left md:text-right">
            <h3
              style={{
                fontFamily: 'var(--font-bs2851-display), serif',
                color: ink,
                fontSize: 'clamp(1.8rem, 3.6vw, 2.8rem)',
                fontWeight: 400,
                lineHeight: 1.15,
              }}
            >
              {pickTestimonialTitle(store)}
            </h3>
          </div>
          <div
            className="aspect-square flex items-center justify-center"
            style={{ backgroundColor: theme.colors.dark }}
          >
            <span
              style={{
                fontFamily: 'var(--font-bs2851-display), serif',
                color: '#FFFFFF',
                fontSize: 'clamp(4rem, 8vw, 6rem)',
                lineHeight: 1,
              }}
              aria-hidden
            >
              &ldquo;
            </span>
          </div>
          <div>
            <p
              className="text-base font-light leading-[1.85] mb-5"
              style={{ color: ink }}
            >
              {pickTestimonialQuote(store)}
            </p>
            <p
              className="text-sm font-light uppercase"
              style={{ color: theme.colors.muted, letterSpacing: '0.18em' }}
            >
              {pickTestimonialAuthor(store)}
            </p>
          </div>
        </div>
      </section>

      {/* ============== LOOKS GRID — "Meilleurs looks et produits" =========== */}
      {lookProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto">
          <p
            className="text-sm font-light mb-3"
            style={{ color: theme.colors.muted, letterSpacing: '0.12em' }}
          >
            #{slugifyHashtag(store.name)}
          </p>
          <h2
            className="mb-12"
            style={{
              fontFamily: 'var(--font-bs2851-display), serif',
              color: ink,
              fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
              fontWeight: 400,
              lineHeight: 1.15,
            }}
          >
            Meilleurs looks et produits
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {lookProducts.map((product) => {
              const image = product.thumbnail || product.images?.[0]?.url;
              return (
                <li key={product.id}>
                  <Link
                    href={`/shop/${store.slug}/products/${product.handle}`}
                    className="group block relative aspect-[4/5] overflow-hidden"
                    style={{ backgroundColor: theme.colors.sand }}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-4xl"
                        style={{ color: theme.colors.muted }}
                        aria-hidden
                      >
                        {store.logoEmoji || '◐'}
                      </div>
                    )}
                    <div
                      className="absolute left-0 right-0 bottom-0 px-4 py-3 text-center"
                      style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
                    >
                      <p
                        className="text-sm font-light truncate"
                        style={{ color: ink }}
                      >
                        {product.title}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============== FOOTER — dark band ====================== */}
      <footer
        className="px-6 sm:px-10 pt-20 pb-10"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <p
              style={{
                fontFamily: 'var(--font-bs2851-display), serif',
                color: '#FFFFFF',
                fontSize: '32px',
                fontWeight: 400,
                marginBottom: 20,
              }}
            >
              {store.name}
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              {truncate(
                store.description || store.tagline || `Une maison ${store.niche} pensée pour vous.`,
                160,
              )}
            </p>
          </div>
          <div>
            <p
              className="text-sm font-light leading-[1.95]"
              style={{ color: 'rgba(255, 255, 255, 0.75)' }}
            >
              Du lundi au samedi
              <br />
              Sur rendez-vous
              <br />
              {store.niche ? `Univers ${store.niche}` : 'Beauté et soins'}
            </p>
          </div>
          <div>
            <p
              className="text-sm font-light uppercase mb-4"
              style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.32em' }}
            >
              Suivez-nous
            </p>
            <ul
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(255, 255, 255, 0.75)' }}
            >
              <li>Instagram</li>
              <li>Pinterest</li>
              <li>Facebook</li>
            </ul>
          </div>
        </div>

        <div
          className="max-w-6xl mx-auto mt-14 pt-8 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs font-light"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.14em',
          }}
        >
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span style={{ color: accent }}>
            {store.niche ? store.niche.toUpperCase() : 'BEAUTÉ'}
          </span>
        </div>
      </footer>
    </div>
  );
}

function pickHeroTitle(store: StoreConfig): string {
  const html = store.landingContent?.hero?.headline_html;
  if (html) return html.replace(/<[^>]+>/g, '').trim();
  return (
    store.tagline ||
    `Une nouvelle vision pour ${store.name}.`
  );
}

function pickHeroLede(store: StoreConfig): string | null {
  const lede = store.landingContent?.hero?.lede;
  if (lede) return lede;
  if (store.description && store.description.length <= 200) return store.description;
  return null;
}

interface ServiceTile {
  title: string;
  body: string;
  image?: string | null;
  icon: string;
}

function buildServiceTiles(
  store: StoreConfig,
  products: BeautySalon2851Product[],
): ServiceTile[] {
  const points = store.landingContent?.selling_points;
  const lifestylePool = store.lifestyleImages.slice(0, 3);
  const fallbackImages = products.slice(0, 3).map((p) => p.thumbnail || p.images?.[0]?.url || null);
  const icons = ['◐', '◯', '◇'];

  if (Array.isArray(points) && points.length >= 3) {
    return points.slice(0, 3).map((p, i) => ({
      title: p.title || `Service ${i + 1}`,
      body: p.body || '',
      image: lifestylePool[i] || fallbackImages[i] || null,
      icon: icons[i],
    }));
  }

  const generic = [
    {
      title: 'Sélection',
      body: store.description
        ? truncate(store.description, 110)
        : `${store.name}, des choix soigneux pour révéler chaque détail.`,
    },
    {
      title: 'Conseil',
      body: store.tagline || `Une approche personnalisée pour ${store.niche || 'votre beauté'}.`,
    },
    {
      title: 'Accompagnement',
      body: `L’équipe ${store.name} reste à votre écoute du premier essai au choix final.`,
    },
  ];

  return generic.map((g, i) => ({
    ...g,
    image: lifestylePool[i] || fallbackImages[i] || null,
    icon: icons[i],
  }));
}

function pickServiceKicker(store: StoreConfig): string {
  const k = store.landingContent?.showcase?.kicker;
  if (k) return k;
  return `Notre signature`;
}

function pickServiceTagline(store: StoreConfig): string {
  const lede = store.landingContent?.showcase?.lede;
  if (lede && lede.length <= 80) return lede;
  return `chez ${store.name}`;
}

function pickTestimonialTitle(store: StoreConfig): string {
  if (store.landingContent?.beach_moment?.headline_html) {
    return store.landingContent.beach_moment.headline_html.replace(/<[^>]+>/g, '').trim();
  }
  return `Le meilleur de ${store.niche || 'la maison'}`;
}

function pickTestimonialQuote(store: StoreConfig): string {
  const lede = store.landingContent?.hero?.lede;
  if (lede) return lede;
  if (store.description) return truncate(store.description, 180);
  return `Une équipe à l’écoute, un savoir-faire qui se voit dès la première visite chez ${store.name}.`;
}

function pickTestimonialAuthor(store: StoreConfig): string {
  return `Une cliente de ${store.name}`;
}

function slugifyHashtag(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
