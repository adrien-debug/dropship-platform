import Link from 'next/link';
import { Poppins } from 'next/font/google';
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

export interface WellnessSoftProduct {
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
  products: WellnessSoftProduct[];
}

/**
 * Wellness Soft Landing — port of the Wix "Ostéopathe / Laurent Moisan"
 * template (https://fr.wix.com/website-template/view/html/2260, health and
 * wellness category).
 *
 * Design grammar lifted from the source:
 *   - Calm, professional service aesthetic. Hero photograph occupies the
 *     right two-thirds of the fold; light Poppins ExtraLight titling sits
 *     on the left over an off-white plate.
 *   - Three info plates overlay the bottom of the hero in a horizontal
 *     strip: slate-blue, muted slate, warm sand. They double as the
 *     storefront's trust block when the design originally listed an
 *     address, opening hours, and a phone number — here they surface
 *     `landingContent.selling_points` or the store's selling promises.
 *   - A six-cell lifestyle grid ("POUR QUI?") becomes the "look around"
 *     catalogue moment: real product photos in a 3x2 grid with the title
 *     beneath each tile.
 *   - A centred testimonial box (single big quote) with a thin divider
 *     above and below — placeholder copy because no review pipeline is
 *     wired yet.
 *   - A full-width slate-blue callout band with a single white headline
 *     replaces the Wix "Qu'est-ce que l'osteopathie ?" CTA — here it
 *     fronts the store's signature product or description.
 *   - A soft sand "ACTUALITÉS" grid reframed as a "Le reste du catalogue"
 *     spillover when the store has more than six SKUs.
 *   - Dark navy footer with three info columns and a newsletter rail.
 *
 * Every piece of copy is wired to `store.*` props so the same scaffold
 * works for a yoga mat store, a skincare line, or a pilates studio. The
 * Wix slate accent (`#71A0BF`) is threaded through `theme.colors.accent`
 * and overridden by `store.primaryColor` / `store.accentColor` when those
 * exist.
 */

// next/font/google — Poppins reproduces the rendered Wix typography
// (the source declares `poppins-extralight, poppins, sans-serif`).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-wellness',
  display: 'swap',
});

// Design tokens captured from the Wix template + the rendered page (the
// info-plate hues live on background images on Wix's side, so the values
// below are eyeballed off the source screenshot).
const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F4F1EB', // warm off-white the hero photo blends into
    soft: '#EFEDE8', // beige for the spillover catalogue band
    ink: '#172A45', // deep navy used for every heading and the footer
    inkSoft: '#292929', // hero-mark ink — Wix renders the H1 at rgb(41,41,41)
    accent: '#71A0BF', // soft slate blue — Wix --wst-color-custom or similar
    accentDeep: '#5F8DA8', // pressed/contrast variant of the accent
    sand: '#C2B193', // warm sand for the third hero info plate
    muted: '#7C8B9C', // body grey for kicker labels
    line: '#E2DED7',
  },
  radius: { plate: 0, button: 0 },
} as const;

export function WellnessSoftLanding({ store, products }: Props) {
  // The Wix accent is just a fallback — every generated store can override
  // it through the design system picker.
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  // Hero photograph fallback chain: hero asset → first product photo →
  // cutout. The Wix design assumes the right two-thirds is a full-bleed
  // editorial shot — when no asset is available we render a soft surface
  // with the store's logo emoji as a placeholder mark.
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Wix uses the H1 as a three-line stack ("CABINET" / "D'OSTÉOPATHIE" /
  // "MOISAN"). We replicate by splitting the store's tagline into up to
  // three lines, falling back to the store name when there's no tagline.
  const heroLines = buildHeroLines(store);

  // Three info plates: the Wix design has three (address / hours /
  // contact). We map them to `landingContent.selling_points` when the AI
  // writer has produced them, falling back to three generic care-promises
  // sourced from the store metadata.
  const plates = buildPlates(store);

  // "POUR QUI?" grid — six product tiles. Originally six lifestyle
  // photos. If the store has fewer than 6 products we still render what's
  // there and pad with the lifestyle photo pool, then with the cutout.
  const gridProducts = products.slice(0, 6);
  const padTiles = padToN(
    [...store.lifestyleImages],
    Math.max(0, 6 - gridProducts.length),
    heroImage,
  );

  // Spillover catalogue — Wix used this band for "ACTUALITÉS" (blog).
  // We re-use it for the long-tail of products past the six-tile grid.
  const restProducts = products.slice(6);

  // Testimonial copy. No review pipeline yet — keep it tasteful and
  // generic, sourced from the store's tagline / description if any.
  const testimonialQuote =
    store.landingContent?.hero?.lede ||
    store.description ||
    store.tagline ||
    `Une expérience ${store.niche} pensée pour durer, dans le respect de chacun.`;

  // QCQ band — Wix uses it as a "What is osteopathy ?" CTA. We re-frame
  // it as a sub-hero: the store's signature pitch on a slate band.
  const showcaseKicker =
    store.landingContent?.showcase?.kicker || 'La maison';
  const showcaseHeadlineHtml = store.landingContent?.showcase?.headline_html;
  const showcaseLede =
    store.landingContent?.showcase?.lede ||
    store.description ||
    `Découvrez l'univers ${store.name} et ses pièces signature.`;

  return (
    <div
      className={poppins.variable}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-wellness), Poppins, sans-serif',
      }}
    >
      {/* ============== NAV — minimal, two columns ============== */}
      <header
        className="relative z-10 px-6 sm:px-10 py-6 border-b"
        style={{ borderColor: theme.colors.line }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="flex flex-col"
            style={{ color: ink }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.42em]"
              style={{ color: theme.colors.muted }}
            >
              {store.niche || 'Maison'}
            </span>
            <span
              className="text-xl font-extralight tracking-tight mt-0.5"
              style={{ color: inkSoft }}
            >
              {store.name}
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-8 text-[11px] uppercase tracking-[0.32em] font-light">
            <span style={{ color: ink }}>Accueil</span>
            <span style={{ color: theme.colors.muted }}>Boutique</span>
            <span style={{ color: theme.colors.muted }}>L&apos;univers</span>
            <span style={{ color: theme.colors.muted }}>Contact</span>
          </nav>
          <span
            className="hidden sm:inline text-[11px] uppercase tracking-[0.32em] font-light"
            style={{ color: ink }}
          >
            Panier (0)
          </span>
        </div>
      </header>

      {/* ============== HERO — split mark + editorial photo + info plates ====== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="relative grid grid-cols-1 md:grid-cols-12 min-h-[80svh]">
          {/* Left: store name stack, light Poppins, big leading */}
          <div className="md:col-span-5 lg:col-span-4 flex items-center px-6 sm:px-12 pt-16 pb-12 md:py-24">
            <div>
              {heroLines.map((line, i) => (
                <h1
                  key={i}
                  className="font-extralight uppercase tracking-tight"
                  style={{
                    color: inkSoft,
                    fontSize: 'clamp(2.25rem, 5vw, 4.25rem)',
                    lineHeight: 1.05,
                    marginBottom: i === heroLines.length - 1 ? 0 : '0.1em',
                  }}
                >
                  {line}
                </h1>
              ))}
              {store.tagline && heroLines.length === 1 && (
                <p
                  className="mt-8 max-w-md text-sm font-light leading-[1.85]"
                  style={{ color: theme.colors.muted }}
                >
                  {store.tagline}
                </p>
              )}
            </div>
          </div>

          {/* Right: full-bleed editorial photo */}
          <div className="md:col-span-7 lg:col-span-8 relative min-h-[420px] md:min-h-0">
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
                  color: theme.colors.muted,
                  backgroundColor: theme.colors.soft,
                }}
                aria-hidden
              >
                {store.logoEmoji || '◇'}
              </div>
            )}
          </div>
        </div>

        {/* Info plates strip — three horizontal cards overlapping the bottom
            of the hero. On mobile they stack vertically just under it. */}
        <div className="px-6 sm:px-12 -mt-10 md:-mt-16 relative z-[1] pb-10 md:pb-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plates.map((plate, idx) => (
              <div
                key={idx}
                className="px-7 py-8 flex flex-col items-center text-center"
                style={{
                  backgroundColor: plate.bg,
                  color: plate.fg,
                }}
              >
                <span
                  aria-hidden
                  className="block mb-3 text-2xl"
                  style={{ color: plate.fg, opacity: 0.85 }}
                >
                  {plate.icon}
                </span>
                <p
                  className="text-[11px] uppercase tracking-[0.4em] font-light mb-2"
                  style={{ color: plate.fg }}
                >
                  {plate.kicker}
                </p>
                <p
                  className="text-sm font-light leading-[1.7]"
                  style={{ color: plate.fg, opacity: 0.9 }}
                >
                  {plate.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== PRODUCTS GRID — "POUR QUI?" three-by-two ============= */}
      {gridProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto">
          <h2
            className="text-center text-3xl sm:text-4xl font-extralight tracking-[0.04em] mb-14"
            style={{ color: ink }}
          >
            La sélection
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            {gridProducts.map((product) => {
              const image = product.thumbnail || product.images?.[0]?.url;
              const variant = product.variants?.[0];
              const price = variant?.calculated_price?.calculated_amount;
              const currency = variant?.calculated_price?.currency_code || 'eur';
              const formattedPrice =
                price !== undefined ? formatMoney(price, currency) : null;
              return (
                <li key={product.id}>
                  <Link
                    href={`/shop/${store.slug}/products/${product.handle}`}
                    className="group block relative aspect-[4/5] overflow-hidden"
                    style={{ backgroundColor: theme.colors.soft }}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
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
                    {/* Title strip — Wix overlays a centred label band
                        beneath each tile. We sit it inside the tile so
                        the catalogue keeps the editorial cadence. */}
                    <div
                      className="absolute left-0 right-0 bottom-0 px-4 py-3 backdrop-blur-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                    >
                      <p
                        className="text-sm font-light tracking-[0.02em] truncate"
                        style={{ color: ink }}
                      >
                        {product.title}
                      </p>
                      {formattedPrice && (
                        <p
                          className="mt-0.5 text-[11px] font-light tabular-nums"
                          style={{ color: theme.colors.muted }}
                        >
                          {formattedPrice}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            {/* Pad with lifestyle photos so the grid stays a full 3x2 even
                when the store has fewer than six products. */}
            {padTiles.map((src, idx) => (
              <li key={`pad-${idx}`} className="relative aspect-[4/5] overflow-hidden">
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
                    className="absolute inset-0 flex items-center justify-center text-4xl"
                    style={{
                      color: theme.colors.muted,
                      backgroundColor: theme.colors.soft,
                    }}
                    aria-hidden
                  >
                    {store.logoEmoji || '◇'}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============== TESTIMONIAL — single centred quote =================== */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-10"
            style={{ color: theme.colors.muted }}
          >
            Témoignages
          </p>
          <div
            className="mx-auto mb-10 w-16 h-px"
            style={{ backgroundColor: theme.colors.line }}
            aria-hidden
          />
          <blockquote
            className="text-lg sm:text-xl font-light leading-[1.85]"
            style={{ color: ink }}
          >
            <span aria-hidden style={{ color: accent }} className="mr-1">
              «
            </span>
            {truncate(testimonialQuote, 220)}
            <span aria-hidden style={{ color: accent }} className="ml-1">
              »
            </span>
          </blockquote>
          <p
            className="mt-8 text-[11px] uppercase tracking-[0.36em] font-light"
            style={{ color: theme.colors.muted }}
          >
            {store.name}
          </p>
          <div
            className="mx-auto mt-10 w-16 h-px"
            style={{ backgroundColor: theme.colors.line }}
            aria-hidden
          />
        </div>
      </section>

      {/* ============== CALLOUT BAND — slate blue, full-width ================ */}
      <section
        className="px-6 sm:px-10 py-24 text-center"
        style={{ backgroundColor: accent }}
      >
        <div className="max-w-3xl mx-auto" style={{ color: '#FFFFFF' }}>
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-6"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {showcaseKicker}
          </p>
          {showcaseHeadlineHtml ? (
            <h2
              className="text-3xl sm:text-4xl font-extralight tracking-[0.02em] leading-[1.25] mb-8"
              dangerouslySetInnerHTML={{ __html: showcaseHeadlineHtml }}
            />
          ) : (
            <h2 className="text-3xl sm:text-4xl font-extralight tracking-[0.02em] leading-[1.25] mb-8">
              {store.tagline || store.name}
            </h2>
          )}
          <p
            className="text-sm sm:text-base font-light leading-[1.85] mb-10"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {showcaseLede}
          </p>
          {products[0] && (
            <Link
              href={`/shop/${store.slug}/products/${products[0].handle}`}
              className="inline-block px-10 py-4 text-[11px] uppercase tracking-[0.36em] font-light transition-colors hover:opacity-90"
              style={{ backgroundColor: '#FFFFFF', color: ink }}
            >
              En savoir plus
            </Link>
          )}
        </div>
      </section>

      {/* ============== SPILLOVER CATALOGUE — soft sand band ================= */}
      {restProducts.length > 0 && (
        <section
          className="px-6 sm:px-10 py-24"
          style={{ backgroundColor: theme.colors.soft }}
        >
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-center text-3xl sm:text-4xl font-extralight tracking-[0.04em] mb-14"
              style={{ color: ink }}
            >
              Le reste du catalogue
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {restProducts.map((product) => {
                const image = product.thumbnail || product.images?.[0]?.url;
                const variant = product.variants?.[0];
                const price = variant?.calculated_price?.calculated_amount;
                const currency = variant?.calculated_price?.currency_code || 'eur';
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
                        style={{ backgroundColor: '#FFFFFF' }}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-4xl"
                            style={{ color: theme.colors.muted }}
                            aria-hidden
                          >
                            {store.logoEmoji || '◇'}
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

      {/* ============== FAST-ADD CTA — single product hook =================== */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-5"
            style={{ color: accent }}
          >
            Notre signature
          </p>
          <h2
            className="text-3xl sm:text-5xl font-extralight tracking-[0.02em] max-w-2xl mx-auto leading-[1.2]"
            style={{ color: ink }}
          >
            {products[0].title}
          </h2>
          <div className="mt-10 max-w-xs mx-auto">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== FOOTER — three columns + newsletter, dark navy ======= */}
      <footer
        className="px-6 sm:px-10 py-20"
        style={{ backgroundColor: ink, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {plates.map((plate, idx) => (
            <div key={idx}>
              <p
                className="text-[11px] uppercase tracking-[0.42em] font-light mb-4"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {plate.kicker}
              </p>
              <p
                className="text-sm font-light leading-[1.85]"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {plate.body}
              </p>
            </div>
          ))}
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-10 pt-12 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.42em] font-light mb-4"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Newsletter
            </p>
            <p
              className="text-sm font-light leading-[1.85] mb-5"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              Recevez nos conseils bien-être et les nouveautés de la boutique.
            </p>
            <form
              className="flex flex-col sm:flex-row gap-3"
              action={`/shop/${store.slug}`}
              method="get"
            >
              <input
                type="email"
                required
                placeholder="votre@email.com"
                aria-label="Adresse email"
                className="flex-1 px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-60"
                style={{
                  borderColor: 'rgba(255,255,255,0.4)',
                  color: '#FFFFFF',
                }}
              />
              <button
                type="submit"
                className="px-6 py-3 text-[11px] uppercase tracking-[0.32em] font-light transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#FFFFFF', color: ink }}
              >
                S&apos;inscrire
              </button>
            </form>
          </div>
          <div className="flex flex-col items-start sm:items-end justify-between gap-4 text-xs font-light" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <p>
              © {new Date().getFullYear()} {store.name}. Tous droits réservés.
            </p>
            <p className="uppercase tracking-[0.32em]">
              {store.niche || 'Maison'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Wix template stacks the store name across up to three uppercase lines.
 * We build the same stack from `store.tagline` when it's a short phrase
 * (≤ 3 words), otherwise from `store.name` split on whitespace, with a
 * sensible single-line fallback.
 */
function buildHeroLines(store: StoreConfig): string[] {
  const tagline = (store.tagline || '').trim();
  if (tagline) {
    const words = tagline.split(/\s+/);
    if (words.length <= 3 && tagline.length <= 32) {
      return words.map((w) => w.toUpperCase());
    }
  }
  const name = (store.name || '').trim();
  if (name) {
    const words = name.split(/\s+/);
    if (words.length <= 3 && name.length <= 32) {
      return words.map((w) => w.toUpperCase());
    }
    return [name.toUpperCase()];
  }
  return ['LA MAISON'];
}

interface Plate {
  kicker: string;
  body: string;
  bg: string;
  fg: string;
  icon: string;
}

/**
 * Three hero info plates. Falls back to a generic "service / care /
 * promise" trio derived from the store metadata when the landing writer
 * hasn't produced selling points yet.
 */
function buildPlates(store: StoreConfig): Plate[] {
  const points = store.landingContent?.selling_points;
  const palette = [
    { bg: theme.colors.accent, fg: '#FFFFFF' },
    { bg: theme.colors.accentDeep, fg: '#FFFFFF' },
    { bg: theme.colors.sand, fg: theme.colors.ink },
  ];
  const icons = ['◯', '◐', '◇'];

  if (Array.isArray(points) && points.length >= 3) {
    return points.slice(0, 3).map((p, i) => ({
      kicker: (p.title || '').toUpperCase(),
      body: p.body || '',
      bg: palette[i].bg,
      fg: palette[i].fg,
      icon: icons[i],
    }));
  }

  // Fallback trio. Generic enough to fit any niche the platform serves.
  return [
    {
      kicker: 'LA MAISON',
      body: store.description
        ? truncate(store.description, 110)
        : `${store.name}, une sélection ${store.niche} pensée pour durer.`,
      bg: palette[0].bg,
      fg: palette[0].fg,
      icon: icons[0],
    },
    {
      kicker: 'L’ESSENTIEL',
      body:
        store.tagline || `Des pièces choisies une à une, livrées avec soin.`,
      bg: palette[1].bg,
      fg: palette[1].fg,
      icon: icons[1],
    },
    {
      kicker: 'CONTACT',
      body: `Une question ? L’équipe ${store.name} répond du lundi au vendredi.`,
      bg: palette[2].bg,
      fg: palette[2].fg,
      icon: icons[2],
    },
  ];
}

/** Pad an image array to `n` entries with a fallback URL or empty slots. */
function padToN(
  arr: Array<string | null | undefined>,
  n: number,
  fallback?: string | null | undefined,
): Array<string | null> {
  if (n <= 0) return [];
  const out: Array<string | null> = arr
    .filter((u): u is string => typeof u === 'string')
    .slice(0, n);
  while (out.length < n) {
    out.push(typeof fallback === 'string' ? fallback : null);
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
