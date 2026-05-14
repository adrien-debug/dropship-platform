import Link from 'next/link';
import { Poppins, Inter } from 'next/font/google';
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

export interface WellnessStudioProduct {
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
  products: WellnessStudioProduct[];
}

/**
 * Wellness Studio Landing — port of the Wix "Centre de fitness / Fit
 * Studio FR" template (https://fr.wix.com/website-template/view/html/2687,
 * health-wellness category).
 *
 * Design grammar lifted from the source:
 *   - Heavy, dark gym aesthetic. The hero is a triptych: three full-bleed
 *     action photographs stitched together at the top, with a bold black
 *     headline "S'entrainer. Transpirer." plate floating over the seam.
 *   - Below the hero, a near-black plate with the offer ("100% de
 *     résultats") in white Poppins Bold paragraph copy.
 *   - The "Nos équipements" section is a 2-up photo block where one
 *     photo overlaps a bright orange offset rectangle (`#FF6B1A`).
 *   - "Nos méthodes" is a horizontal photo filmstrip — five low-height
 *     images side by side.
 *   - "Contactez-nous" is a dark contact form on a deeper grey plate.
 *   - Footer is a thin near-black band with three columns + copyright.
 *
 * The template translates well to a sport / training / strength
 * dropshipping store. Brand colour is threaded as `accent` (Wix orange)
 * and overridden by `store.accentColor`. Poppins Bold is loaded via
 * next/font/google as a stand-in for Wix's proprietary Poppins variant.
 */

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-studio-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-studio-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    ink: '#262626', // near-black H1 color from Wix
    dark: '#16161A', // panel / footer
    darker: '#0C0C0E', // deepest contact plate
    accent: '#FF6B1A', // hot orange offset rectangle
    accentSoft: '#FFB780',
    cream: '#F2F0EB',
    line: 'rgba(255,255,255,0.12)',
    muted: '#7A7A82',
  },
  radius: { square: 0, pill: 9999 },
} as const;

export function WellnessStudioLanding({ store, products }: Props) {
  const accent = store.accentColor || theme.colors.accent;
  const ink = theme.colors.ink;

  // Hero triptych — three photos. We use the first three product
  // thumbnails (or lifestyle frames) and pad with the hero image.
  const heroBase =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const heroStrip = padArray(
    [
      ...products.slice(0, 3).map((p) => p.thumbnail || p.images?.[0]?.url || null),
      ...store.lifestyleImages.slice(0, 3),
    ].filter(Boolean) as string[],
    3,
    heroBase,
  );

  // 5-photo filmstrip ("Nos méthodes")
  const filmstrip = padArray(
    [
      ...store.lifestyleImages,
      ...products.map((p) => p.thumbnail || p.images?.[0]?.url || null),
    ].filter(Boolean) as string[],
    5,
    heroBase,
  );

  const equipments = products.slice(0, 2);

  return (
    <div
      className={`${poppins.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-studio-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — thin, dark ================================== */}
      <header
        className="relative z-10 px-6 sm:px-10 py-4"
        style={{ backgroundColor: theme.colors.bg, borderBottom: `1px solid ${theme.colors.cream}` }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href={`/shop/${store.slug}`}
            className="inline-flex items-center gap-3"
          >
            <span
              aria-hidden
              className="inline-block w-7 h-7"
              style={{ backgroundColor: ink }}
            />
            <span
              className="text-lg uppercase tracking-[0.18em]"
              style={{
                color: ink,
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontWeight: 800,
              }}
            >
              {store.name}
            </span>
          </Link>
          <nav
            className="hidden sm:flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] font-bold"
            style={{ color: ink }}
          >
            <span>Accueil</span>
            <span>Méthodes</span>
            <span>Boutique</span>
            <span>Contact</span>
          </nav>
          <Link
            href={`/shop/${store.slug}#contact`}
            className="hidden sm:inline px-4 py-2 text-[11px] uppercase tracking-[0.22em] font-bold"
            style={{ backgroundColor: ink, color: '#FFFFFF' }}
          >
            Réserver
          </Link>
        </div>
      </header>

      {/* ============== HERO — photo triptych + bold plate ================ */}
      <section className="relative w-full overflow-hidden">
        <div className="grid grid-cols-3 gap-0 w-full" style={{ height: 'clamp(360px, 65vh, 640px)' }}>
          {heroStrip.map((src, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden"
              style={{ backgroundColor: theme.colors.dark }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{ color: theme.colors.muted }}
                  aria-hidden
                >
                  {store.logoEmoji || '◇'}
                </div>
              )}
              {/* Soft black gradient overlay so the central plate stays
                  readable regardless of photo content. */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
                }}
              />
            </div>
          ))}
        </div>
        {/* Plate */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto px-8 sm:px-14 py-7 sm:py-10 text-center max-w-3xl mx-6"
            style={{
              backgroundColor: theme.colors.bg,
              boxShadow: '0 30px 70px -30px rgba(0,0,0,0.5)',
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.42em] font-bold mb-4"
              style={{ color: accent }}
            >
              {store.niche || 'Strength'} · Studio
            </p>
            <h1
              className="uppercase"
              style={{
                color: ink,
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontSize: 'clamp(2.5rem, 6vw, 5.25rem)',
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
              }}
            >
              {buildHeadline(store)}
            </h1>
            <p
              className="mt-5 text-sm sm:text-base font-medium leading-[1.6] max-w-xl mx-auto"
              style={{ color: ink }}
            >
              {store.tagline ||
                `${store.name} accompagne celles et ceux qui veulent voir des résultats dans le ${store.niche || 'bien-être'}.`}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {products[0] && (
                <Link
                  href={`/shop/${store.slug}/products/${products[0].handle}`}
                  className="inline-block px-7 py-3 text-[11px] uppercase tracking-[0.22em] font-bold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: ink, color: '#FFFFFF' }}
                >
                  Découvrir
                </Link>
              )}
              <Link
                href={`/shop/${store.slug}#methodes`}
                className="inline-block px-7 py-3 text-[11px] uppercase tracking-[0.22em] font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: accent, color: '#FFFFFF' }}
              >
                Méthodes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============== RESULTS BAND — dark plate ========================= */}
      <section
        className="px-6 sm:px-10 py-20"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <h2
            className="uppercase mb-6"
            style={{
              fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
            }}
          >
            100% de résultats
          </h2>
          <p
            className="text-sm sm:text-base font-light leading-[1.85] max-w-2xl mx-auto mb-10"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            {store.description ||
              `Une sélection ${store.niche || 'bien-être'} pensée pour durer. Des matériaux qui tiennent, des coupes qui suivent l'effort, un service après-vente qui répond.`}
          </p>
          <Link
            href={`/shop/${store.slug}#contact`}
            className="inline-block px-9 py-4 text-[11px] uppercase tracking-[0.32em] font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: accent, color: '#FFFFFF' }}
          >
            Nous contacter
          </Link>
        </div>
      </section>

      {/* ============== NOS ÉQUIPEMENTS — 2-up with orange offset ========= */}
      {equipments.length > 0 && (
        <section
          className="px-6 sm:px-10 py-24"
          style={{ backgroundColor: theme.colors.bg }}
          id="equipements"
        >
          <div className="max-w-6xl mx-auto">
            <h2
              className="uppercase mb-12"
              style={{
                color: ink,
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              Nos équipements
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              {/* Orange offset rectangle — Wix's signature visual hinge. */}
              <div
                aria-hidden
                className="absolute hidden md:block"
                style={{
                  top: '-2rem',
                  right: '-1rem',
                  width: '40%',
                  height: '70%',
                  backgroundColor: accent,
                  zIndex: 0,
                }}
              />
              {equipments.map((product, idx) => {
                const image = product.thumbnail || product.images?.[0]?.url;
                const variant = product.variants?.[0];
                const price = variant?.calculated_price?.calculated_amount;
                const currency = variant?.calculated_price?.currency_code || 'eur';
                const formattedPrice =
                  price !== undefined ? formatMoney(price, currency) : null;
                return (
                  <li
                    key={product.id}
                    className="relative z-[1]"
                    style={{
                      backgroundColor: theme.colors.bg,
                      transform: idx === 1 ? 'translateY(-1.5rem)' : undefined,
                    }}
                  >
                    <Link
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group block"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-6xl"
                            style={{ color: theme.colors.muted, backgroundColor: theme.colors.cream }}
                            aria-hidden
                          >
                            {store.logoEmoji || '◇'}
                          </div>
                        )}
                      </div>
                      <div className="px-1 py-5 flex items-baseline justify-between gap-4">
                        <p
                          className="text-base uppercase tracking-[0.08em]"
                          style={{
                            color: ink,
                            fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                            fontWeight: 700,
                          }}
                        >
                          {product.title}
                        </p>
                        {formattedPrice && (
                          <p
                            className="text-sm font-bold tabular-nums shrink-0"
                            style={{ color: ink }}
                          >
                            {formattedPrice}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ============== NOS MÉTHODES — 5-photo filmstrip ================== */}
      <section
        className="px-6 sm:px-10 py-20"
        style={{ backgroundColor: theme.colors.cream }}
        id="methodes"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
            <h2
              className="uppercase"
              style={{
                color: ink,
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              Nos méthodes
            </h2>
            <p
              className="text-sm font-medium uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {store.niche || 'Sport'} · 2026
            </p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            {filmstrip.map((src, idx) => (
              <li
                key={idx}
                className="relative aspect-square overflow-hidden"
                style={{ backgroundColor: theme.colors.dark }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 hover:opacity-90"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-5xl"
                    style={{ color: theme.colors.muted }}
                    aria-hidden
                  >
                    {store.logoEmoji || '◇'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== CLOSING CTA — signature fast-add =================== */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.bg }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-bold mb-4"
            style={{ color: accent }}
          >
            Notre signature
          </p>
          <h2
            className="uppercase mb-8 max-w-2xl mx-auto"
            style={{
              color: ink,
              fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
            }}
          >
            {products[0].title}
          </h2>
          <div className="max-w-xs mx-auto">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== CONTACT — dark plate with form ==================== */}
      <section
        className="px-6 sm:px-10 py-24"
        style={{ backgroundColor: theme.colors.darker, color: '#FFFFFF' }}
        id="contact"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <h2
              className="uppercase mb-5"
              style={{
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.25rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
              }}
            >
              Contactez-nous
            </h2>
            <p
              className="text-sm font-light leading-[1.85] max-w-md"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {`L'équipe ${store.name} vous répond sous 24h ouvrées. Questions, conseils ou suivi de commande, on est là.`}
            </p>
            <p
              className="mt-6 text-[11px] uppercase tracking-[0.32em] font-bold"
              style={{ color: accent }}
            >
              Réponse sous 24h
            </p>
          </div>
          <form
            className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4"
            action={`/shop/${store.slug}`}
            method="get"
          >
            <input
              type="text"
              required
              placeholder="Prénom"
              aria-label="Prénom"
              className="px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-60"
              style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }}
            />
            <input
              type="text"
              required
              placeholder="Nom"
              aria-label="Nom"
              className="px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-60"
              style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }}
            />
            <input
              type="email"
              required
              placeholder="Email"
              aria-label="Email"
              className="px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-60 sm:col-span-2"
              style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }}
            />
            <textarea
              rows={4}
              placeholder="Votre message"
              aria-label="Votre message"
              className="px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-60 sm:col-span-2 resize-none"
              style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }}
            />
            <button
              type="submit"
              className="sm:col-span-2 mt-2 px-8 py-3 text-[11px] uppercase tracking-[0.32em] font-bold"
              style={{ backgroundColor: accent, color: '#FFFFFF' }}
            >
              Envoyer
            </button>
          </form>
        </div>
      </section>

      {/* ============== FOOTER — thin near-black band ===================== */}
      <footer
        className="px-6 sm:px-10 py-10"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div
          className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.22em] font-medium"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-block w-5 h-5"
              style={{ backgroundColor: accent }}
            />
            <span
              style={{
                fontFamily: 'var(--font-studio-display), Poppins, sans-serif',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '0.18em',
              }}
            >
              {store.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <span>Boutique</span>
            <span>Méthodes</span>
            <span>Contact</span>
            <span>Mentions légales</span>
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function buildHeadline(store: StoreConfig): string {
  const tagline = (store.tagline || '').trim();
  if (tagline && tagline.length <= 40) return tagline;
  return `S'entrainer. ${(store.niche || 'transpirer').toLowerCase()}.`;
}

function padArray<T>(arr: T[], n: number, fill: T): T[] {
  const out: T[] = arr.slice(0, n);
  while (out.length < n) out.push(fill);
  return out;
}
