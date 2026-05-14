import Link from 'next/link';
import { Manrope, Inter } from 'next/font/google';
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

export interface WellnessPulseProduct {
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
  products: WellnessPulseProduct[];
}

/**
 * Wellness Pulse Landing — port of the Wix "Professeur de fitness /
 * Émilie Fox" template (https://fr.wix.com/website-template/view/html/2464,
 * health-wellness category).
 *
 * Design grammar lifted from the source:
 *   - High-energy personal-trainer site. The hero is a horizontal split:
 *     left a giant Futura-Book name + tagline "Découvrez votre pouvoir",
 *     right a full-bleed photograph of the trainer mid-pose. Background
 *     is a flat soft-teal `#A1C7CC` plate that wraps both halves.
 *   - The accent block sitting at the seam is a hot lime-yellow square
 *     `#E0FF3F` — Wix uses it as a visual hinge between the photo and
 *     the next "Je suis Émilie" intro section.
 *   - The page alternates: deep navy `#253C57` text on cream, then
 *     lime accent rectangles, then "Réserver un cours" with three card
 *     tiles (FoxFit Débutants / Master / Intro). Each card has a soft
 *     teal CTA button "Réserver".
 *   - A muted "Couverture médiatique" thin logo strip and a "FoxFit sur
 *     mobile" closing CTA banner before the footer.
 *   - Footer is a flat navy band with a contact form on a wider column.
 *
 * The platform threads the brand through `theme.lime` and `theme.teal`
 * but every accent honours `store.accentColor` / `store.primaryColor`
 * when set, so a green-tea store reads differently from a strength-
 * training one without touching the template.
 */

// next/font/google — Manrope substitutes Wix's proprietary Futura LT
// (geometric, generous tracking). Inter for body / form labels.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-pulse-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-pulse-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FAF7F1', // soft cream
    teal: '#A1C7CC', // Wix accent fill on CTAs and hero plate
    tealDeep: '#7DAFB6', // hover state
    lime: '#E0FF3F', // hot lime-yellow rectangles
    limeSoft: '#F2FF8C', // washed lime for hover
    ink: '#253C57', // deep navy — H1, H2 colour
    inkSoft: '#3F5872',
    cream: '#F0EBE0', // sub-section surface
    muted: '#8693A6',
    line: '#D9D5CB',
  },
  radius: { plate: 0, pill: 9999 },
} as const;

export function WellnessPulseLanding({ store, products }: Props) {
  // Accent inheritance — every generated store can override the lime by
  // dropping a primary colour. The teal stays as a structural mid-tone.
  const accent = store.accentColor || theme.colors.lime;
  const brandFill = store.primaryColor || theme.colors.teal;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Wix "Réserver un cours" tiles — three card slots. We use the first
  // three products, padding with placeholder concept cards when the store
  // hasn't got enough SKUs.
  const tiles = products.slice(0, 3);
  const tileCount = 3;

  // Press strip ("Couverture médiatique") — flat row of muted logo
  // placeholders, replaced by `store.lifestyleImages` first frames when
  // they exist.
  const pressTiles = padArray(
    store.lifestyleImages.slice(0, 5),
    5,
    null,
  );

  return (
    <div
      className={`${manrope.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-pulse-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — slim, single line ============================ */}
      <header
        className="relative z-10 px-6 sm:px-10 py-4"
        style={{
          backgroundColor: theme.colors.bg,
          borderBottom: `1px solid ${theme.colors.line}`,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href={`/shop/${store.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em]"
            style={{
              color: ink,
              fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
            }}
          >
            <span
              aria-hidden
              className="inline-block w-3 h-3"
              style={{ backgroundColor: accent }}
            />
            {store.name}
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-[12px] uppercase tracking-[0.22em] font-medium" style={{ color: inkSoft }}>
            <span style={{ color: ink }}>Accueil</span>
            <span>À propos</span>
            <span>Boutique</span>
            <span>Réserver</span>
            <span>Contact</span>
          </nav>
          <Link
            href={`/shop/${store.slug}#booking`}
            className="hidden sm:inline px-4 py-2 text-[11px] uppercase tracking-[0.22em] font-medium"
            style={{
              backgroundColor: brandFill,
              color: ink,
            }}
          >
            Réserver
          </Link>
        </div>
      </header>

      {/* ============== HERO — name + tagline + photo plate =============== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: theme.colors.teal }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 max-w-7xl mx-auto px-6 sm:px-10 pt-14 pb-20 md:py-24 gap-8 items-center">
          <div className="md:col-span-6">
            <h1
              className="uppercase"
              style={{
                color: ink,
                fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
                fontSize: 'clamp(3rem, 8vw, 7.5rem)',
                fontWeight: 300,
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
              }}
            >
              {store.name}
            </h1>
            {store.tagline && (
              <p
                className="mt-6 text-base sm:text-lg font-light leading-[1.6] max-w-md"
                style={{ color: inkSoft }}
              >
                {store.tagline}
              </p>
            )}
            <div className="mt-10 flex flex-wrap gap-3">
              {products[0] && (
                <Link
                  href={`/shop/${store.slug}/products/${products[0].handle}`}
                  className="inline-block px-7 py-3 text-[12px] uppercase tracking-[0.22em] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: ink, color: theme.colors.bg }}
                >
                  Découvrir
                </Link>
              )}
              <Link
                href={`/shop/${store.slug}#booking`}
                className="inline-block px-7 py-3 text-[12px] uppercase tracking-[0.22em] font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: theme.colors.bg, color: ink }}
              >
                Réserver
              </Link>
            </div>
          </div>
          <div className="md:col-span-6 relative">
            <div
              className="relative aspect-[4/5] overflow-hidden"
              style={{ backgroundColor: theme.colors.tealDeep }}
            >
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
                  style={{ color: theme.colors.bg }}
                  aria-hidden
                >
                  {store.logoEmoji || '◇'}
                </div>
              )}
              {/* Hot lime hinge — Wix's signature accent rectangle */}
              <div
                aria-hidden
                className="absolute -left-6 bottom-10 w-32 h-32 sm:w-40 sm:h-40"
                style={{ backgroundColor: accent }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============== INTRO + LIME PLATE ================================ */}
      <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.bg }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 relative">
            <div className="relative aspect-square overflow-hidden">
              {(store.lifestyleImages[0] || heroImage) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.lifestyleImages[0] || heroImage || ''}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  aria-hidden
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-5xl"
                  style={{ color: theme.colors.muted, backgroundColor: theme.colors.cream }}
                  aria-hidden
                >
                  {store.logoEmoji || '◇'}
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-7 relative">
            {/* Lime overlap square behind the copy block */}
            <div
              aria-hidden
              className="absolute -top-6 right-0 w-32 h-32 sm:w-44 sm:h-44 -z-0"
              style={{ backgroundColor: accent }}
            />
            <div className="relative">
              <h2
                className="uppercase mb-6"
                style={{
                  color: ink,
                  fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
                  fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                  fontWeight: 300,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.05,
                }}
              >
                {store.landingContent?.hero?.kicker || 'L’histoire'}
              </h2>
              <p
                className="text-sm sm:text-base font-light leading-[1.85] max-w-xl"
                style={{ color: inkSoft }}
              >
                {store.description ||
                  store.tagline ||
                  `${store.name} c'est une sélection ${store.niche || 'bien-être'} pensée pour celles et ceux qui veulent rester en mouvement. Des pièces choisies pour leur tenue, leur confort et la promesse qu'elles incarnent.`}
              </p>
              {products[0] && (
                <Link
                  href={`/shop/${store.slug}/products/${products[0].handle}`}
                  className="inline-block mt-8 px-7 py-3 text-[12px] uppercase tracking-[0.22em] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: ink, color: theme.colors.bg }}
                >
                  Lire plus
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============== TILES — Réserver un cours / La sélection ========== */}
      {tiles.length > 0 && (
        <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.cream }}>
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-center uppercase mb-14"
              style={{
                color: ink,
                fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                fontWeight: 300,
                letterSpacing: '-0.01em',
              }}
            >
              La sélection
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-7">
              {Array.from({ length: tileCount }).map((_, idx) => {
                const product = tiles[idx];
                if (!product) {
                  return (
                    <li
                      key={`empty-${idx}`}
                      className="aspect-[3/4] flex items-center justify-center text-4xl"
                      style={{
                        backgroundColor: theme.colors.teal,
                        color: theme.colors.bg,
                      }}
                      aria-hidden
                    >
                      {store.logoEmoji || '◇'}
                    </li>
                  );
                }
                const image = product.thumbnail || product.images?.[0]?.url;
                const variant = product.variants?.[0];
                const price = variant?.calculated_price?.calculated_amount;
                const currency = variant?.calculated_price?.currency_code || 'eur';
                const formattedPrice =
                  price !== undefined ? formatMoney(price, currency) : null;
                return (
                  <li
                    key={product.id}
                    className="flex flex-col"
                    style={{ backgroundColor: theme.colors.bg }}
                  >
                    <Link
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group flex flex-col h-full"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-5xl"
                            style={{
                              color: theme.colors.muted,
                              backgroundColor: theme.colors.cream,
                            }}
                            aria-hidden
                          >
                            {store.logoEmoji || '◇'}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-5 flex-1 flex flex-col">
                        <p
                          className="text-base font-medium leading-snug mb-2"
                          style={{
                            color: ink,
                            fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
                          }}
                        >
                          {product.title}
                        </p>
                        {formattedPrice && (
                          <p
                            className="text-xs font-light tabular-nums mb-4"
                            style={{ color: inkSoft }}
                          >
                            {formattedPrice}
                          </p>
                        )}
                        <span
                          className="mt-auto inline-block self-start px-5 py-2 text-[11px] uppercase tracking-[0.22em] font-medium"
                          style={{
                            backgroundColor: brandFill,
                            color: ink,
                          }}
                        >
                          Réserver
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ============== PRESS STRIP — Couverture médiatique =============== */}
      <section className="px-6 sm:px-10 py-20" style={{ backgroundColor: theme.colors.bg }}>
        <div className="max-w-5xl mx-auto text-center">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-medium mb-10"
            style={{ color: inkSoft }}
          >
            Couverture médiatique
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-80">
            {pressTiles.map((src, idx) => (
              <li
                key={idx}
                className="w-20 h-12 flex items-center justify-center"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    aria-hidden
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="text-[11px] uppercase tracking-[0.32em] font-light"
                    style={{ color: theme.colors.muted }}
                  >
                    {['VOGUE', 'ELLE', 'GLAMOUR', 'GQ', 'BOOM'][idx]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== CLOSING CTA BANNER — lime full bleed ============== */}
      <section
        className="px-6 sm:px-10 py-24 text-center"
        style={{ backgroundColor: accent, color: ink }}
      >
        <div className="max-w-3xl mx-auto">
          <h2
            className="uppercase mb-6"
            style={{
              fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
              fontSize: 'clamp(2.25rem, 5vw, 4.25rem)',
              fontWeight: 300,
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
            }}
          >
            {store.tagline ? store.tagline : `${store.name} sur mobile`}
          </h2>
          <p
            className="text-sm sm:text-base font-light leading-[1.85] mb-10 max-w-xl mx-auto"
            style={{ color: inkSoft }}
          >
            {store.landingContent?.final_cta?.lede ||
              `Toute la sélection ${store.niche || 'bien-être'} dans votre poche. Achetez en quelques gestes, livraison soignée à la maison.`}
          </p>
          {products[0]?.variants?.[0] && (
            <div className="max-w-xs mx-auto">
              <AddToCartButton
                variantId={products[0].variants[0].id}
                storeSlug={store.slug}
              />
            </div>
          )}
        </div>
      </section>

      {/* ============== FOOTER — flat navy ================================= */}
      <footer
        className="px-6 sm:px-10 py-20"
        style={{ backgroundColor: ink, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-14">
          <div>
            <p
              className="text-base tracking-[0.32em] uppercase mb-4"
              style={{
                fontFamily: 'var(--font-pulse-display), Manrope, sans-serif',
                fontWeight: 500,
              }}
            >
              {store.name}
            </p>
            <p
              className="text-sm font-light leading-[1.8]"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {store.description
                ? truncate(store.description, 160)
                : `${store.name} accompagne celles et ceux qui veulent rester en mouvement.`}
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-medium mb-4"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Boutique
            </p>
            <ul className="space-y-2 text-sm font-light" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <li>La sélection</li>
              <li>Nouveautés</li>
              <li>Conseils</li>
              <li>FAQ livraison</li>
            </ul>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-medium mb-4"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Newsletter
            </p>
            <p className="text-sm font-light leading-[1.8] mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Nos nouveautés et conseils {store.niche || 'bien-être'}, une fois par mois.
            </p>
            <form
              className="flex gap-2"
              action={`/shop/${store.slug}`}
              method="get"
            >
              <input
                type="email"
                required
                placeholder="votre@email.com"
                aria-label="Adresse email"
                className="flex-1 px-3 py-2 text-sm font-light bg-transparent border outline-none placeholder:opacity-60"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#FFFFFF' }}
              />
              <button
                type="submit"
                className="px-4 py-2 text-[11px] uppercase tracking-[0.22em] font-medium"
                style={{ backgroundColor: accent, color: ink }}
              >
                OK
              </button>
            </form>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto pt-8 flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.22em] font-light"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span>{store.niche || 'Bien-être'}</span>
        </div>
      </footer>
    </div>
  );
}

function padArray<T>(arr: T[], n: number, fill: T): T[] {
  const out: T[] = arr.slice(0, n);
  while (out.length < n) out.push(fill);
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
