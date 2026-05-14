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

export interface WellnessRetreatProduct {
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
  products: WellnessRetreatProduct[];
}

/**
 * Wellness Retreat Landing — port of the Wix "Retraite / 2179-retreat-yoga"
 * template (https://fr.wix.com/website-template/view/html/2179, health and
 * wellness category, yoga retreat archetype).
 *
 * Design grammar lifted from the source preview:
 *   - Luminous, contemplative aesthetic. Hero is a full-width oceanic photo
 *     with a centred two-line serif title ("S'ÉVADER ET RAJEUNIR") in
 *     ExtraLight Cormorant Garamond, breathing space all around.
 *   - A small yellow CTA pill anchors the hero ("EXPLORER"). The yellow
 *     (`#F2CB47`) is the only saturated accent in the whole composition.
 *   - Sub-hero "events" strip with a soft photo band and a centred ghost
 *     button ("Voir toutes les retraites à venir") — we re-frame it as the
 *     "Notre sélection" CTA when products exist.
 *   - Single-photo testimonial band with very light overlay text — used
 *     here for the store's signature pitch or a recurring tagline.
 *   - Centred contact block with a thin slate input form on white.
 *   - Soft turquoise newsletter rail in the footer.
 *
 * Every label is fed by `store.*` so the same scaffold renders for a yoga
 * studio, a meditation app, or a wellness apparel brand. The Wix
 * turquoise (`#7BB6C2`) is exposed as `theme.colors.accentSoft` and can be
 * overridden by `store.primaryColor` / `store.accentColor`.
 */

// Cormorant Garamond reproduces the elegant ExtraLight serif Wix uses for
// the hero headlines; Inter handles body copy / nav / kickers in light.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-retreat-display',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-retreat-body',
  display: 'swap',
});

// Design tokens captured from the rendered Wix preview. Hex values are
// eyeballed off the source screenshot since Wix obfuscates its CSS vars
// behind hashed class names.
const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F6F4EE', // cream backdrop used behind the testimonial copy
    ink: '#2C3E45', // deep slate used for headings + footer
    inkSoft: '#4A5A60', // body copy
    muted: '#8A9498', // kickers and meta
    accent: '#F2CB47', // signature yellow CTA pill — the one saturated hit
    accentSoft: '#7BB6C2', // turquoise sea / newsletter band
    line: '#E2DFD7',
  },
  radius: { pill: 9999, button: 0 },
} as const;

export function WellnessRetreatLanding({ store, products }: Props) {
  const accent =
    store.accentColor || store.primaryColor || theme.colors.accent;
  const accentSoft = store.secondaryColor || theme.colors.accentSoft;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  // Hero image — Wix uses an editorial seascape with a centred figure. We
  // fall back through the standard chain: hero asset → first product photo
  // → cutout → soft surface placeholder.
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Wix splits the H1 across two short lines ("S'ÉVADER ET / RAJEUNIR").
  // We mirror the structure: if the tagline naturally splits into two
  // halves (around a conjunction or comma) we use those; otherwise we use
  // the store name with a generic sub-line.
  const [heroLineA, heroLineB] = buildHeroLines(store);

  // Sub-hero pitch — Wix shows "Avec une retraite de yoga" under the H1
  // in a small serif italic. We use the kicker from landingContent, or a
  // niche-driven fallback.
  const heroSub =
    store.landingContent?.hero?.kicker || subFromNiche(store);

  // Section blocks for the "Voir toutes les retraites à venir" strip and
  // the testimonial band — content fed by landingContent or sensible
  // defaults built from store metadata.
  const showcaseKicker =
    store.landingContent?.showcase?.kicker || 'La maison';
  const showcaseHeadlineHtml =
    store.landingContent?.showcase?.headline_html;
  const showcaseLede =
    store.landingContent?.showcase?.lede ||
    store.description ||
    `Une collection ${store.niche} composée avec soin pour celles et ceux qui prennent le temps.`;

  // Products grid — Wix uses a horizontal "next event" rail. We adapt it
  // as a 4-card grid below the hero so the catalogue gets first-fold
  // visibility after the photographic intro.
  const gridProducts = products.slice(0, 4);
  const restProducts = products.slice(4);

  const lifestyleImages = store.lifestyleImages.slice(0, 2);
  const testimonialImage =
    lifestyleImages[0] ||
    products[1]?.thumbnail ||
    products[1]?.images?.[0]?.url ||
    heroImage;

  return (
    <div
      className={`${cormorant.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-retreat-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — minimal three-zone bar ============== */}
      <header className="relative z-10 px-6 sm:px-10 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] font-light"
            style={{ color: ink }}
          >
            <span aria-hidden style={{ color: accent }}>
              {store.logoEmoji || '◆'}
            </span>
            <span>{store.name}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-8 text-[11px] uppercase tracking-[0.32em] font-light">
            <span style={{ color: ink }}>Accueil</span>
            <span style={{ color: theme.colors.muted }}>La maison</span>
            <span style={{ color: theme.colors.muted }}>Boutique</span>
            <span style={{ color: theme.colors.muted }}>Contact</span>
          </nav>
          <span
            className="hidden sm:inline text-[11px] uppercase tracking-[0.32em] font-light"
            style={{ color: theme.colors.muted }}
          >
            Panier (0)
          </span>
        </div>
      </header>

      {/* ============== HERO — full-bleed photo + centred serif title ===== */}
      <section className="relative w-full overflow-hidden">
        <div className="relative w-full" style={{ minHeight: '78svh' }}>
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={store.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(160deg, ${accentSoft} 0%, ${theme.colors.surface} 100%)`,
              }}
              aria-hidden
            />
          )}
          {/* Faint white wash so the serif headline reads on any photo. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.55) 100%)',
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-32 min-h-[78svh]">
            <div
              style={{
                fontFamily:
                  'var(--font-retreat-display), Cormorant Garamond, serif',
              }}
            >
              <h1
                className="font-light tracking-[0.08em] leading-[1.05]"
                style={{
                  color: ink,
                  fontSize: 'clamp(2.5rem, 6.5vw, 5.5rem)',
                }}
              >
                {heroLineA}
              </h1>
              {heroLineB && (
                <h1
                  className="font-light tracking-[0.08em] leading-[1.05]"
                  style={{
                    color: ink,
                    fontSize: 'clamp(2.5rem, 6.5vw, 5.5rem)',
                  }}
                >
                  {heroLineB}
                </h1>
              )}
            </div>
            <p
              className="mt-8 italic text-base sm:text-lg font-light max-w-xl"
              style={{
                color: inkSoft,
                fontFamily:
                  'var(--font-retreat-display), Cormorant Garamond, serif',
              }}
            >
              {heroSub}
            </p>
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="mt-12 inline-block px-9 py-3 text-[11px] uppercase tracking-[0.36em] font-medium transition-transform hover:scale-[1.02]"
                style={{
                  backgroundColor: accent,
                  color: ink,
                  borderRadius: theme.radius.pill,
                }}
              >
                Explorer
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============== UPCOMING / SELECTION STRIP ================== */}
      {gridProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto text-center">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-6"
            style={{ color: theme.colors.muted }}
          >
            Notre sélection
          </p>
          <h2
            className="font-light leading-tight mb-12"
            style={{
              color: ink,
              fontFamily:
                'var(--font-retreat-display), Cormorant Garamond, serif',
              fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
              letterSpacing: '0.04em',
            }}
          >
            {store.tagline || `L'univers ${store.name}`}
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {gridProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storeSlug={store.slug}
                logoEmoji={store.logoEmoji}
                theme={theme}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ============== TESTIMONIAL BAND — photo + serif overlay ========== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ minHeight: 420 }}
      >
        {testimonialImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={testimonialImage}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: theme.colors.surface }}
            aria-hidden
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(44,62,69,0.32) 0%, rgba(44,62,69,0.55) 100%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-28 sm:py-36">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-6"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            {showcaseKicker}
          </p>
          {showcaseHeadlineHtml ? (
            <h2
              className="font-light leading-[1.2] mb-6"
              style={{
                color: '#FFFFFF',
                fontFamily:
                  'var(--font-retreat-display), Cormorant Garamond, serif',
                fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
              }}
              dangerouslySetInnerHTML={{ __html: showcaseHeadlineHtml }}
            />
          ) : (
            <h2
              className="font-light leading-[1.2] mb-6"
              style={{
                color: '#FFFFFF',
                fontFamily:
                  'var(--font-retreat-display), Cormorant Garamond, serif',
                fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
              }}
            >
              {store.tagline || store.name}
            </h2>
          )}
          <p
            className="text-sm sm:text-base font-light leading-[1.85] max-w-2xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.88)' }}
          >
            {truncate(showcaseLede, 240)}
          </p>
        </div>
      </section>

      {/* ============== SPILLOVER CATALOGUE ============================ */}
      {restProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto">
          <h2
            className="text-center font-light leading-tight mb-12"
            style={{
              color: ink,
              fontFamily:
                'var(--font-retreat-display), Cormorant Garamond, serif',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              letterSpacing: '0.04em',
            }}
          >
            Le reste du catalogue
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {restProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storeSlug={store.slug}
                logoEmoji={store.logoEmoji}
                theme={theme}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ============== FAST-ADD SIGNATURE ============================ */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-light mb-5"
            style={{ color: theme.colors.muted }}
          >
            Notre signature
          </p>
          <h2
            className="font-light leading-tight max-w-2xl mx-auto mb-10"
            style={{
              color: ink,
              fontFamily:
                'var(--font-retreat-display), Cormorant Garamond, serif',
              fontSize: 'clamp(1.75rem, 4vw, 3rem)',
              letterSpacing: '0.04em',
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

      {/* ============== CONTACT BLOCK — centred form on white ============ */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="font-light leading-tight mb-3"
            style={{
              color: ink,
              fontFamily:
                'var(--font-retreat-display), Cormorant Garamond, serif',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            }}
          >
            Contact
          </h2>
          <p
            className="text-sm font-light leading-[1.85] mb-10"
            style={{ color: theme.colors.muted }}
          >
            Une question sur la boutique ou nos pièces ? L&apos;équipe{' '}
            {store.name} vous répond rapidement.
          </p>
          <form
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            action={`/shop/${store.slug}`}
            method="get"
          >
            <input
              type="text"
              required
              placeholder="Prénom"
              aria-label="Prénom"
              className="px-4 py-3 text-sm font-light bg-white outline-none placeholder:opacity-60 border"
              style={{ borderColor: theme.colors.line, color: ink }}
            />
            <input
              type="email"
              required
              placeholder="votre@email.com"
              aria-label="Email"
              className="px-4 py-3 text-sm font-light bg-white outline-none placeholder:opacity-60 border"
              style={{ borderColor: theme.colors.line, color: ink }}
            />
            <textarea
              placeholder="Votre message"
              aria-label="Message"
              rows={4}
              className="sm:col-span-2 px-4 py-3 text-sm font-light bg-white outline-none placeholder:opacity-60 border resize-none"
              style={{ borderColor: theme.colors.line, color: ink }}
            />
            <div className="sm:col-span-2 flex justify-center">
              <button
                type="submit"
                className="mt-2 px-9 py-3 text-[11px] uppercase tracking-[0.36em] font-medium"
                style={{
                  backgroundColor: accent,
                  color: ink,
                  borderRadius: theme.radius.pill,
                }}
              >
                Envoyer
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ============== FOOTER — turquoise newsletter rail ============= */}
      <footer
        className="px-6 sm:px-10 py-14"
        style={{ backgroundColor: accentSoft, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.42em] font-light mb-3"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              S&apos;abonner aux mises à jour
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Restez à l&apos;écoute des nouveautés {store.name}.
            </p>
          </div>
          <form
            className="flex flex-col sm:flex-row gap-3"
            action={`/shop/${store.slug}`}
            method="get"
          >
            <input
              type="email"
              required
              placeholder="Saisir votre email"
              aria-label="Adresse email"
              className="flex-1 px-4 py-3 text-sm font-light bg-white outline-none placeholder:opacity-60"
              style={{ color: ink }}
            />
            <button
              type="submit"
              className="px-7 py-3 text-[11px] uppercase tracking-[0.36em] font-medium"
              style={{
                backgroundColor: accent,
                color: ink,
                borderRadius: theme.radius.pill,
              }}
            >
              S&apos;abonner
            </button>
          </form>
        </div>
        <div
          className="max-w-6xl mx-auto mt-10 pt-6 text-xs font-light flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          <p>
            © {new Date().getFullYear()} {store.name}. Tous droits réservés.
          </p>
          <p className="uppercase tracking-[0.32em]">
            {store.niche || 'Maison'}
          </p>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({
  product,
  storeSlug,
  logoEmoji,
  theme: t,
}: {
  product: WellnessRetreatProduct;
  storeSlug: string;
  logoEmoji: string;
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
        className="group block"
      >
        <div
          className="relative aspect-[4/5] overflow-hidden mb-3"
          style={{ backgroundColor: t.colors.surface }}
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
              style={{ color: t.colors.muted }}
              aria-hidden
            >
              {logoEmoji || '◆'}
            </div>
          )}
        </div>
        <p
          className="text-sm font-light tracking-[0.02em]"
          style={{ color: t.colors.ink }}
        >
          {product.title}
        </p>
        {formattedPrice && (
          <p
            className="mt-1 text-[11px] font-light tabular-nums"
            style={{ color: t.colors.muted }}
          >
            {formattedPrice}
          </p>
        )}
      </Link>
    </li>
  );
}

/**
 * Build a two-line uppercase hero stack. Wix uses an "AND"-split (e.g.
 * "S'ÉVADER ET / RAJEUNIR"); we try to mirror it via the tagline, falling
 * back to the store name + a generic sub-line.
 */
function buildHeroLines(store: StoreConfig): [string, string | null] {
  const tagline = (store.tagline || '').trim();
  if (tagline) {
    // Look for natural breaks: " et ", " & ", " - ", " — ", " , ".
    const splitters = [
      /\s+et\s+/i,
      /\s*&\s*/,
      /\s*[—-]\s*/,
      /\s*,\s*/,
    ];
    for (const re of splitters) {
      const parts = tagline.split(re);
      if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) {
        return [
          parts[0].trim().toUpperCase(),
          parts[1].trim().toUpperCase(),
        ];
      }
    }
    if (tagline.length <= 28) {
      return [tagline.toUpperCase(), null];
    }
  }
  const name = (store.name || 'Maison').trim();
  return [name.toUpperCase(), null];
}

/** Italic serif sub-line under the hero — niche-aware fallback. */
function subFromNiche(store: StoreConfig): string {
  const n = (store.niche || '').toLowerCase();
  if (n.includes('yoga') || n.includes('méditation')) {
    return 'Avec une retraite de yoga';
  }
  if (n.includes('beauté') || n.includes('skin') || n.includes('soin')) {
    return 'Un rituel quotidien à soi';
  }
  if (n.includes('sport') || n.includes('fitness')) {
    return 'Le mouvement comme état d’esprit';
  }
  return `L'univers ${store.name}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
