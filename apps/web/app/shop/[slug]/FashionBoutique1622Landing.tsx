import Link from 'next/link';
import { Cormorant_Garamond, Raleway } from 'next/font/google';
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

export interface FashionBoutique1622Product {
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
  products: FashionBoutique1622Product[];
}

/**
 * Fashion Boutique 1622 Landing — port of the Wix "Nana Chic" clothing
 * store template (https://www.wix.com/templatesfr/1622-clothing-store).
 *
 * Design grammar lifted from the source:
 *   - Slim dark charcoal header bar (#303132) with a light-grey wordmark
 *     (#D3D3D3) and letter-spaced sans nav, classic late-2010s e-commerce
 *     boutique look.
 *   - Beige off-white background (#F7F6F4) for the body to keep a calm
 *     editorial feeling between the dark chrome.
 *   - Hero photo with a centred translucent plate carrying a serif title
 *     ("SAISON HIVER" at 55px Times-style serif) and a small dark CTA.
 *   - "INTEMPORELS / Les indispensables" section title set in widely
 *     letter-spaced uppercase Raleway, a thin divider, then a 3-column
 *     product grid where each tile has a dark bottom strip with the
 *     product name overlaid.
 *   - Dark charcoal footer with three columns (RESTEZ CONNECTÉ·E social
 *     icons, DEVENONS AMIS newsletter, BESOIN D'AIDE ? phone + email).
 *
 * Slot wiring:
 *   - Hero title comes from `landingContent.hero.kicker` (uppercased) or a
 *     "saison" derivative of `store.tagline`. The hero photo is
 *     `store.heroImageUrl → first product photo → cutout`.
 *   - "Les indispensables" surfaces the first 3 products. Each tile uses
 *     the product image + title; a fourth product becomes a "PROMO"
 *     featured tile when available.
 */

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-fb1622-serif',
  display: 'swap',
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-fb1622-sans',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#F7F6F4', // body warm off-white
    surface: '#FFFFFF',
    ink: '#303132', // header + footer + body type
    inkSoft: '#5A5A5A',
    light: '#D3D3D3', // logotype + footer secondary text
    line: '#E2DED7',
    plate: 'rgba(247, 246, 244, 0.85)', // hero translucent plate
    overlay: 'rgba(48, 49, 50, 0.55)', // dark tile bottom strip
  },
} as const;

export function FashionBoutique1622Landing({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.ink;
  const ink = theme.colors.ink;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const heroTitle = pickHeroTitle(store);
  const heroSub = pickHeroSub(store);

  const featured = products.slice(0, 3);
  const promoProduct = products[3] ?? null;

  return (
    <div
      className={`${serif.variable} ${raleway.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-fb1622-sans), Raleway, sans-serif',
      }}
    >
      {/* ============== HEADER — dark charcoal bar ============== */}
      <header
        className="w-full"
        style={{ backgroundColor: theme.colors.ink, color: theme.colors.light }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="font-bold uppercase"
            style={{
              fontFamily: 'var(--font-fb1622-sans), Raleway, sans-serif',
              fontSize: '17px',
              letterSpacing: '0.32em',
              color: theme.colors.light,
            }}
          >
            {store.name}
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[13px] uppercase font-light">
            <span style={{ color: theme.colors.surface, letterSpacing: '0.18em' }}>
              Accueil
            </span>
            <span style={{ color: theme.colors.light, letterSpacing: '0.18em' }}>
              Boutique
            </span>
            <span style={{ color: theme.colors.light, letterSpacing: '0.18em' }}>
              Promo
            </span>
            <span style={{ color: theme.colors.light, letterSpacing: '0.18em' }}>
              Service client
            </span>
            <span style={{ color: theme.colors.light, letterSpacing: '0.18em' }}>
              Panier (0)
            </span>
          </nav>
        </div>
      </header>

      {/* ============== HERO — full-bleed photo + translucent plate ============== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ minHeight: 'clamp(440px, 60vh, 620px)' }}
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
            style={{
              backgroundColor: theme.colors.line,
              color: theme.colors.inkSoft,
            }}
            aria-hidden
          >
            {store.logoEmoji || 'NC'}
          </div>
        )}
        <div className="relative z-10 flex items-center justify-center min-h-[440px] md:min-h-[620px] py-16">
          <div
            className="px-10 py-12 sm:px-16 sm:py-14 text-center"
            style={{
              backgroundColor: theme.colors.plate,
              maxWidth: 540,
            }}
          >
            <h1
              className="uppercase"
              style={{
                fontFamily: 'var(--font-fb1622-serif), "Times New Roman", serif',
                color: ink,
                fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
                fontWeight: 400,
                letterSpacing: '0.08em',
                lineHeight: 1.05,
                marginBottom: 24,
              }}
            >
              {heroTitle}
            </h1>
            {heroSub && (
              <p
                className="mb-7 text-sm font-light"
                style={{
                  color: theme.colors.inkSoft,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {heroSub}
              </p>
            )}
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-block px-10 py-3 text-[12px] uppercase font-light transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: ink,
                  color: '#FFFFFF',
                  letterSpacing: '0.32em',
                }}
              >
                Acheter
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============== INFO STRIP — slim livraison band ============== */}
      <section
        className="px-6 py-5 text-center border-b"
        style={{
          backgroundColor: theme.colors.bg,
          borderColor: theme.colors.line,
        }}
      >
        <p
          className="text-[12px] uppercase font-light"
          style={{ color: ink, letterSpacing: '0.42em' }}
        >
          {pickShippingLine(store)}
        </p>
      </section>

      {/* ============== PRODUCT GRID — "INTEMPORELS / Les indispensables" ====== */}
      {featured.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="uppercase"
              style={{
                fontFamily: 'var(--font-fb1622-sans), Raleway, sans-serif',
                color: ink,
                fontSize: 'clamp(1.05rem, 1.6vw, 1.25rem)',
                fontWeight: 700,
                letterSpacing: '0.45em',
                marginBottom: 18,
              }}
            >
              {pickCollectionKicker(store)}
            </h2>
            <div
              className="mx-auto w-8 h-px"
              style={{ backgroundColor: ink }}
              aria-hidden
            />
            <p
              className="mt-5 text-sm font-light"
              style={{
                color: theme.colors.inkSoft,
                letterSpacing: '0.22em',
              }}
            >
              {pickCollectionTagline(store)}
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {featured.map((product, idx) => {
              const image = product.thumbnail || product.images?.[0]?.url;
              const variant = product.variants?.[0];
              const price = variant?.calculated_price?.calculated_amount;
              const currency = variant?.calculated_price?.currency_code || 'eur';
              const formattedPrice =
                price !== undefined ? formatMoney(price, currency) : null;
              const isPromo = idx === 1 && promoProduct === null;
              return (
                <li key={product.id}>
                  <Link
                    href={`/shop/${store.slug}/products/${product.handle}`}
                    className="group relative block aspect-[3/4] overflow-hidden"
                    style={{ backgroundColor: theme.colors.surface }}
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
                        style={{ color: theme.colors.inkSoft }}
                        aria-hidden
                      >
                        {store.logoEmoji || 'N'}
                      </div>
                    )}
                    {isPromo && (
                      <span
                        className="absolute top-6 left-1/2 -translate-x-1/2 uppercase"
                        style={{
                          fontFamily: 'var(--font-fb1622-serif), serif',
                          color: ink,
                          fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                          letterSpacing: '0.36em',
                        }}
                      >
                        P R O M O
                      </span>
                    )}
                    <div
                      className="absolute left-0 right-0 bottom-0 px-4 py-4 text-center"
                      style={{ backgroundColor: theme.colors.overlay }}
                    >
                      <p
                        className="text-[13px] uppercase font-light truncate"
                        style={{
                          color: '#FFFFFF',
                          letterSpacing: '0.18em',
                        }}
                      >
                        {product.title}
                      </p>
                      {formattedPrice && (
                        <p
                          className="mt-1 text-[11px] font-light tabular-nums"
                          style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            letterSpacing: '0.12em',
                          }}
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

          {products.length > 3 && (
            <div className="mt-16 text-center">
              <Link
                href={`/shop/${store.slug}`}
                className="inline-block px-10 py-3 text-[12px] uppercase font-light border transition-colors hover:bg-white"
                style={{
                  borderColor: ink,
                  color: ink,
                  letterSpacing: '0.36em',
                }}
              >
                Voir toute la boutique
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ============== SIGNATURE / ADD TO CART — single hero product ========= */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[12px] uppercase font-light mb-5"
            style={{ color: accent, letterSpacing: '0.42em' }}
          >
            Notre signature
          </p>
          <h2
            className="uppercase mx-auto max-w-2xl"
            style={{
              fontFamily: 'var(--font-fb1622-serif), serif',
              color: ink,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              letterSpacing: '0.06em',
              lineHeight: 1.15,
              marginBottom: 28,
            }}
          >
            {products[0].title}
          </h2>
          <div className="mx-auto max-w-xs">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== FOOTER — dark charcoal, 3 columns ===================== */}
      <footer
        className="px-6 sm:px-10 pt-16 pb-10"
        style={{ backgroundColor: theme.colors.ink, color: theme.colors.light }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12">
          <div>
            <p
              className="text-[12px] uppercase font-light mb-5"
              style={{ letterSpacing: '0.42em' }}
            >
              Restez connecté·e
            </p>
            <p
              className="text-[13px] font-light leading-[1.85]"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              Suivez {store.name} pour découvrir nos nouveautés et nos coups de cœur saison.
            </p>
          </div>
          <div>
            <p
              className="text-[12px] uppercase font-light mb-5"
              style={{ letterSpacing: '0.42em' }}
            >
              Devenons amis
            </p>
            <p
              className="text-[13px] font-light leading-[1.85] mb-4"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              Recevez nos nouveautés et offres en avant-première.
            </p>
            <form
              className="flex gap-2"
              action={`/shop/${store.slug}`}
              method="get"
            >
              <input
                type="email"
                required
                placeholder="Votre adresse email"
                aria-label="Adresse email"
                className="flex-1 px-3 py-2 text-[13px] font-light bg-transparent border outline-none placeholder:opacity-50"
                style={{
                  borderColor: 'rgba(211, 211, 211, 0.4)',
                  color: theme.colors.light,
                }}
              />
              <button
                type="submit"
                className="px-5 py-2 text-[12px] uppercase font-light transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: theme.colors.light,
                  color: theme.colors.ink,
                  letterSpacing: '0.22em',
                }}
              >
                S&apos;abonner
              </button>
            </form>
          </div>
          <div>
            <p
              className="text-[12px] uppercase font-light mb-5"
              style={{ letterSpacing: '0.42em' }}
            >
              Besoin d&apos;aide ?
            </p>
            <p
              className="text-[13px] font-light leading-[1.85]"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              Notre équipe répond du lundi au vendredi.
              <br />
              {store.niche ? `Catégorie : ${store.niche}` : 'Mode et accessoires'}
            </p>
          </div>
        </div>

        <div
          className="max-w-6xl mx-auto mt-14 pt-8 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[12px] font-light"
          style={{
            borderColor: 'rgba(211, 211, 211, 0.18)',
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.18em',
          }}
        >
          <span className="uppercase">
            © {new Date().getFullYear()} {store.name}
          </span>
          <span className="uppercase">Mentions légales · Confidentialité</span>
        </div>
      </footer>
    </div>
  );
}

function pickHeroTitle(store: StoreConfig): string {
  const kicker = store.landingContent?.hero?.kicker;
  if (kicker && kicker.length <= 28) return kicker.toUpperCase();
  const tagline = (store.tagline || '').trim();
  if (tagline) {
    const short = tagline.split(/\s+/).slice(0, 3).join(' ');
    if (short.length <= 28) return short.toUpperCase();
  }
  return 'NOUVELLE COLLECTION';
}

function pickHeroSub(store: StoreConfig): string | null {
  const lede = store.landingContent?.hero?.lede;
  if (lede && lede.length <= 90) return lede;
  if (store.tagline && store.tagline.length <= 90) return store.tagline;
  return null;
}

function pickShippingLine(store: StoreConfig): string {
  const points = store.landingContent?.selling_points;
  if (Array.isArray(points) && points[0]?.title) {
    return points[0].title;
  }
  return `Livraison soignée ${store.niche || 'mode'}`;
}

function pickCollectionKicker(store: StoreConfig): string {
  const kicker = store.landingContent?.showcase?.kicker;
  if (kicker && kicker.length <= 24) return kicker.toUpperCase();
  return 'INTEMPORELS';
}

function pickCollectionTagline(store: StoreConfig): string {
  const lede = store.landingContent?.showcase?.lede;
  if (lede && lede.length <= 80) return lede;
  return 'Les indispensables';
}
