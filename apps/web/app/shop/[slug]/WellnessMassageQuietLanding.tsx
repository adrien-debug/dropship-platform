import Link from 'next/link';
import { Cormorant_Garamond, Inter } from 'next/font/google';
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

export interface WellnessMassageQuietProduct {
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
  products: WellnessMassageQuietProduct[];
}

/**
 * Wellness Massage (Quiet) Landing — port of the Wix "Massage Therapist
 * (Soft) / Palmer" template (https://fr.wix.com/website-template/view/html/wh-1252,
 * health and wellness category, massage therapy archetype).
 *
 * Design grammar lifted from the source preview:
 *   - Hushed, spa-grade editorial. Hero is a split layout: left holds a
 *     centred serif/italic headline "Find Your Quiet" with the word
 *     "Your" italicised, right is a desaturated warm photograph of hands
 *     and a tealight.
 *   - Service list is rendered as a long single column: each row is a
 *     three-zone strip — left mini-photo, italic serif title with a
 *     numeric prefix ("Swedish / Relaxation"), right cream metadata
 *     ("60 min · $95") with a thin "Book Now" link beneath.
 *   - A centred quote / "Meet Your Therapist" section uses a mini round
 *     portrait with name + italic role beneath.
 *   - Footer is a warm dark-brown bar with three columns: address /
 *     business hours / social, plus a thin newsletter input.
 *
 * Palette: dusty cream `#EFE8DD`, warm-brown ink `#4A3A2C`, off-white
 * tile `#FAF6EF`, deep cocoa footer `#3D2E22`. Every piece of copy is fed
 * by `store.*` props.
 */

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-quiet-display',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-quiet-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FAF6EF',
    surface: '#EFE8DD', // cream backdrop of the hero left column
    tile: '#F5EFE5', // service row card
    ink: '#4A3A2C', // warm brown — every heading
    inkSoft: '#6B5A4A',
    muted: '#8C7A68',
    accent: '#B58A55', // warm copper / honey CTA
    accentDeep: '#8E6537',
    footer: '#3D2E22', // deep cocoa
    line: '#E2D9C9',
  },
  radius: { tile: 4, pill: 9999 },
} as const;

export function WellnessMassageQuietLanding({ store, products }: Props) {
  const accent =
    store.accentColor || store.primaryColor || theme.colors.accent;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Wix splits its hero into "Find Your Quiet". We mirror with a 2-word
  // accent: first/last word straight, middle word italicised in serif.
  const heroSegments = buildHeroSegments(store);

  // Hero subline — the Wix copy reads "Therapeutic bodywork tailored to
  // you. Find longevity in calm." We fall back to the store's tagline or
  // a niche-derived sentence.
  const heroSubline =
    store.landingContent?.hero?.lede ||
    store.tagline ||
    sublineFromNiche(store);

  // Services list — Wix renders ~4 rows. We map to the first 6 products,
  // then offer a "Voir tous les soins" hyperlink to the catalogue.
  const services = products.slice(0, 6);
  const restProducts = products.slice(6);

  // "Meet Your Therapist" block. Wix shows a round portrait + italic role.
  // We use the cutout image if present, or a lifestyle still.
  const therapistImage =
    store.lifestyleImages[0] ||
    store.cutoutImageUrl ||
    products[1]?.thumbnail ||
    products[1]?.images?.[0]?.url;
  const therapistRole =
    store.landingContent?.showcase?.kicker || `Fondatrice · ${store.niche || 'Maison'}`;
  const therapistBlurb =
    store.landingContent?.showcase?.lede ||
    store.description ||
    `${store.name} cultive un point de vue calme et incarné sur ${store.niche || 'le bien-être'}, pièce par pièce.`;

  return (
    <div
      className={`${cormorant.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-quiet-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — wordmark + minimal links + Book CTA ======== */}
      <header
        className="relative z-10 px-6 sm:px-10 py-5 border-b"
        style={{
          borderColor: theme.colors.line,
          backgroundColor: theme.colors.bg,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="text-base sm:text-lg tracking-[0.3em] uppercase font-light"
            style={{ color: ink }}
          >
            {store.name}
          </Link>
          <nav className="hidden sm:flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase font-light">
            <span style={{ color: ink }}>À propos</span>
            <span style={{ color: theme.colors.muted }}>Soins</span>
            <span style={{ color: theme.colors.muted }}>Contact</span>
            <span style={{ color: theme.colors.muted }}>Connexion</span>
          </nav>
          {products[0] && (
            <Link
              href={`/shop/${store.slug}/products/${products[0].handle}`}
              className="hidden sm:inline-block px-5 py-2.5 text-[12px] uppercase tracking-[0.28em] font-medium"
              style={{
                backgroundColor: ink,
                color: theme.colors.bg,
              }}
            >
              Réserver
            </Link>
          )}
        </div>
      </header>

      {/* ============== HERO — split layout, serif italic accent ========= */}
      <section
        className="relative w-full"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[78svh]">
          {/* Left column: serif headline + subline + small CTA */}
          <div className="flex items-center px-6 sm:px-14 py-20">
            <div className="max-w-md">
              <h1
                className="font-light leading-[1.05]"
                style={{
                  color: ink,
                  fontFamily:
                    'var(--font-quiet-display), Cormorant Garamond, serif',
                  fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)',
                }}
              >
                {heroSegments[0]}{' '}
                <em
                  className="font-light"
                  style={{
                    fontFamily:
                      'var(--font-quiet-display), Cormorant Garamond, serif',
                    color: accent,
                  }}
                >
                  {heroSegments[1]}
                </em>{' '}
                {heroSegments[2]}
              </h1>
              <p
                className="mt-7 text-base font-light leading-[1.85]"
                style={{ color: inkSoft }}
              >
                {heroSubline}
              </p>
              {products[0] && (
                <Link
                  href={`/shop/${store.slug}/products/${products[0].handle}`}
                  className="mt-10 inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.32em] font-medium border-b pb-1.5"
                  style={{
                    color: ink,
                    borderColor: ink,
                  }}
                >
                  <span>Voir les soins</span>
                  <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          </div>
          {/* Right column: warm photograph */}
          <div className="relative min-h-[420px] md:min-h-0">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={store.name}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'saturate(0.85)' }}
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-7xl"
                style={{
                  color: theme.colors.muted,
                  backgroundColor: theme.colors.tile,
                }}
                aria-hidden
              >
                {store.logoEmoji || '◆'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============== SERVICES LIST — 3-zone rows ====================== */}
      {services.length > 0 && (
        <section className="px-6 sm:px-10 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p
                className="text-[11px] uppercase tracking-[0.42em] font-light mb-4"
                style={{ color: theme.colors.muted }}
              >
                Therapeutic Bodywork
              </p>
              <h2
                className="font-light leading-tight"
                style={{
                  color: ink,
                  fontFamily:
                    'var(--font-quiet-display), Cormorant Garamond, serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                }}
              >
                Nos{' '}
                <em
                  style={{
                    color: accent,
                    fontFamily:
                      'var(--font-quiet-display), Cormorant Garamond, serif',
                  }}
                >
                  soins
                </em>{' '}
                signature
              </h2>
            </div>
            <ul className="divide-y" style={{ borderColor: theme.colors.line }}>
              {services.map((product, idx) => (
                <ServiceRow
                  key={product.id}
                  index={idx + 1}
                  product={product}
                  storeSlug={store.slug}
                  logoEmoji={store.logoEmoji}
                  accent={accent}
                  theme={theme}
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============== MEET YOUR THERAPIST ============================= */}
      <section
        className="px-6 sm:px-10 py-24"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="mx-auto mb-8 w-32 h-32 sm:w-40 sm:h-40 overflow-hidden"
            style={{
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.tile,
            }}
          >
            {therapistImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={therapistImage}
                alt={store.name}
                className="w-full h-full object-cover"
                style={{ filter: 'saturate(0.9)' }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-5xl"
                style={{ color: theme.colors.muted }}
                aria-hidden
              >
                {store.logoEmoji || '◆'}
              </div>
            )}
          </div>
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-3"
            style={{ color: theme.colors.muted }}
          >
            Meet Your Therapist
          </p>
          <h3
            className="font-light leading-tight mb-2"
            style={{
              color: ink,
              fontFamily:
                'var(--font-quiet-display), Cormorant Garamond, serif',
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
            }}
          >
            {store.name}
          </h3>
          <p
            className="italic font-light text-base mb-6"
            style={{
              color: accent,
              fontFamily:
                'var(--font-quiet-display), Cormorant Garamond, serif',
            }}
          >
            {therapistRole}
          </p>
          <p
            className="text-sm sm:text-base font-light leading-[1.95] max-w-2xl mx-auto"
            style={{ color: inkSoft }}
          >
            {truncate(therapistBlurb, 320)}
          </p>
        </div>
      </section>

      {/* ============== FAST-ADD ======================================= */}
      {products[0]?.variants?.[0] && (
        <section className="px-6 sm:px-10 py-24 text-center">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-4"
            style={{ color: theme.colors.muted }}
          >
            Notre signature
          </p>
          <h2
            className="font-light leading-tight max-w-2xl mx-auto mb-10"
            style={{
              color: ink,
              fontFamily:
                'var(--font-quiet-display), Cormorant Garamond, serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
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

      {/* ============== SPILLOVER ====================================== */}
      {restProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.tile }}>
          <div className="max-w-5xl mx-auto">
            <h2
              className="text-center font-light leading-tight mb-12"
              style={{
                color: ink,
                fontFamily:
                  'var(--font-quiet-display), Cormorant Garamond, serif',
                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              }}
            >
              Le reste du{' '}
              <em
                style={{
                  color: accent,
                  fontFamily:
                    'var(--font-quiet-display), Cormorant Garamond, serif',
                }}
              >
                catalogue
              </em>
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {restProducts.map((product) => {
                const image = product.thumbnail || product.images?.[0]?.url;
                const variant = product.variants?.[0];
                const price = variant?.calculated_price?.calculated_amount;
                const currency =
                  variant?.calculated_price?.currency_code || 'eur';
                const formattedPrice =
                  price !== undefined ? formatMoney(price, currency) : null;
                return (
                  <li key={product.id}>
                    <Link
                      href={`/shop/${store.slug}/products/${product.handle}`}
                      className="group block"
                    >
                      <div
                        className="relative aspect-[4/5] overflow-hidden mb-3"
                        style={{ backgroundColor: theme.colors.surface }}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                            style={{ filter: 'saturate(0.92)' }}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-4xl"
                            style={{ color: theme.colors.muted }}
                            aria-hidden
                          >
                            {store.logoEmoji || '◆'}
                          </div>
                        )}
                      </div>
                      <p
                        className="text-sm font-light tracking-[0.02em]"
                        style={{ color: ink }}
                      >
                        {product.title}
                      </p>
                      {formattedPrice && (
                        <p
                          className="mt-1 text-[11px] font-light tabular-nums"
                          style={{ color: theme.colors.muted }}
                        >
                          {formattedPrice}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ============== FOOTER — deep cocoa ============================= */}
      <footer
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: theme.colors.footer, color: '#F4ECDF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <p
              className="text-base tracking-[0.3em] uppercase font-light mb-4"
              style={{ color: '#F4ECDF' }}
            >
              {store.name}
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(244,236,223,0.72)' }}
            >
              {truncate(
                store.description || store.tagline || sublineFromNiche(store),
                160,
              )}
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-medium mb-4"
              style={{ color: 'rgba(244,236,223,0.55)' }}
            >
              Adresse
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(244,236,223,0.85)' }}
            >
              Atelier · sur rendez-vous
              <br />
              {store.niche || 'Maison'}
              <br />
              Paris, France
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-medium mb-4"
              style={{ color: 'rgba(244,236,223,0.55)' }}
            >
              Horaires
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(244,236,223,0.85)' }}
            >
              Lun-Ven · 09h-19h
              <br />
              Samedi · 10h-17h
              <br />
              Dim · sur demande
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-medium mb-4"
              style={{ color: 'rgba(244,236,223,0.55)' }}
            >
              Newsletter
            </p>
            <p
              className="text-sm font-light leading-[1.85] mb-5"
              style={{ color: 'rgba(244,236,223,0.85)' }}
            >
              Conseils, rituels et nouveautés.
            </p>
            <form
              className="flex flex-col sm:flex-row gap-2"
              action={`/shop/${store.slug}`}
              method="get"
            >
              <input
                type="email"
                required
                placeholder="email"
                aria-label="Email"
                className="flex-1 px-3 py-2 text-sm font-light bg-transparent border outline-none placeholder:opacity-50"
                style={{
                  borderColor: 'rgba(244,236,223,0.3)',
                  color: '#F4ECDF',
                }}
              />
              <button
                type="submit"
                className="px-4 py-2 text-[11px] uppercase tracking-[0.28em] font-medium"
                style={{ backgroundColor: accent, color: theme.colors.footer }}
              >
                Ok
              </button>
            </form>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto pt-6 text-xs font-light flex flex-col sm:flex-row sm:justify-between gap-3"
          style={{
            borderTop: '1px solid rgba(244,236,223,0.12)',
            color: 'rgba(244,236,223,0.55)',
          }}
        >
          <p>
            © {new Date().getFullYear()} {store.name}. Tous droits réservés.
          </p>
          <p className="uppercase tracking-[0.28em]">
            {store.niche || 'Atelier'}
          </p>
        </div>
      </footer>
    </div>
  );
}

function ServiceRow({
  index,
  product,
  storeSlug,
  logoEmoji,
  accent,
  theme: t,
}: {
  index: number;
  product: WellnessMassageQuietProduct;
  storeSlug: string;
  logoEmoji: string;
  accent: string;
  theme: typeof theme;
}) {
  const image = product.thumbnail || product.images?.[0]?.url;
  const variant = product.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const formattedPrice =
    price !== undefined ? formatMoney(price, currency) : null;
  return (
    <li>
      <Link
        href={`/shop/${storeSlug}/products/${product.handle}`}
        className="group flex flex-col sm:flex-row items-stretch gap-6 py-7"
      >
        <div
          className="relative w-full sm:w-40 h-32 sm:h-32 overflow-hidden shrink-0"
          style={{ backgroundColor: t.colors.tile }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
              style={{ filter: 'saturate(0.9)' }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-3xl"
              style={{ color: t.colors.muted }}
              aria-hidden
            >
              {logoEmoji || '◆'}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1">
            <p
              className="text-[11px] uppercase tracking-[0.42em] font-light mb-1.5"
              style={{ color: t.colors.muted }}
            >
              {String(index).padStart(2, '0')}
            </p>
            <h3
              className="font-light leading-tight mb-2"
              style={{
                color: t.colors.ink,
                fontFamily:
                  'var(--font-quiet-display), Cormorant Garamond, serif',
                fontSize: '1.5rem',
              }}
            >
              {product.title}
            </h3>
            {product.description && (
              <p
                className="text-sm font-light leading-[1.7] max-w-md"
                style={{ color: t.colors.inkSoft }}
              >
                {truncate(product.description, 140)}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            {formattedPrice && (
              <p
                className="text-sm font-medium tabular-nums mb-2"
                style={{ color: t.colors.ink }}
              >
                {formattedPrice}
              </p>
            )}
            <span
              className="inline-block text-[12px] uppercase tracking-[0.32em] font-medium border-b pb-1"
              style={{ color: accent, borderColor: accent }}
            >
              Réserver
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

/**
 * Build a 3-segment hero with the middle word italicised. Wix's source is
 * "Find / Your / Quiet". We try to mirror it with the tagline when it
 * splits cleanly into three words, otherwise we synthesise.
 */
function buildHeroSegments(store: StoreConfig): [string, string, string] {
  const tagline = (store.tagline || '').trim();
  if (tagline) {
    const words = tagline.split(/\s+/);
    if (words.length === 3 && tagline.length <= 32) {
      return [words[0], words[1], words[2]];
    }
    if (words.length === 2 && tagline.length <= 24) {
      return [words[0], words[1], ''];
    }
  }
  // Niche-aware fallback.
  const n = (store.niche || '').toLowerCase();
  if (n.includes('massage') || n.includes('spa')) {
    return ['Find', 'Your', 'Quiet'];
  }
  if (n.includes('beauté') || n.includes('skin') || n.includes('soin')) {
    return ['Un', 'rituel', 'pour soi'];
  }
  if (n.includes('yoga') || n.includes('méditation')) {
    return ['Trouver', 'son', 'calme'];
  }
  return ['Bienvenue', 'chez', store.name || 'nous'];
}

function sublineFromNiche(store: StoreConfig): string {
  const n = (store.niche || '').toLowerCase();
  if (n.includes('massage') || n.includes('spa')) {
    return `Un soin corporel pensé pour la durée et la tranquillité.`;
  }
  if (n.includes('beauté') || n.includes('skin')) {
    return `Des rituels sensoriels, formulés avec retenue.`;
  }
  return `Un ${store.niche || 'art de vivre'} cultivé avec patience, pièce après pièce.`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
