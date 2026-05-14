import Link from 'next/link';
import { Manrope } from 'next/font/google';
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

export interface WellnessFitnessBlogProduct {
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
  products: WellnessFitnessBlogProduct[];
}

/**
 * Wellness Fitness Blog Landing — port of the Wix "Blog de fitness /
 * En mouv'" template (https://fr.wix.com/website-template/view/html/2503,
 * health and wellness category, fitness coach archetype).
 *
 * Design grammar lifted from the source preview:
 *   - Energetic editorial blog. Hero is a bold script logo "En mouv'"
 *     with a lime-yellow hand-drawn underline; the H1 sits left-aligned
 *     in a heavy sans serif ("Reste / En Mouv'").
 *   - A "POSTS À L'AFFICHE" banner introduces a 2-column featured strip:
 *     each card is a full-bleed photo with a yellow inline label
 *     ("Push yourself proud") and a quick-CTA pill at the bottom right.
 *   - Three category bands stack vertically: "FITNESS" / "NUTRITION" /
 *     "MOTIVATION". Each band has a kicker label, a "Voir plus" pill on
 *     the right, then 2 cards beneath — one yellow editorial tile + one
 *     photo card with a short overlay caption.
 *   - "À L'AFFICHE DANS" social rail with two square cards.
 *   - Dark footer in pure black with the wordmark inverted and three
 *     thin link columns + a newsletter signup.
 *
 * The platform doesn't have a blog pipeline, so we re-purpose the
 * category bands as merchandising surfaces: "FITNESS" hosts the first
 * row of products, "NUTRITION" / "MOTIVATION" feed off the AI-written
 * landingContent or the rest of the catalogue. Every label is sourced
 * from `store.*`.
 */

// Manrope reproduces Wix's contemporary geometric sans (the source uses
// Madefor Display in heavy weights). Manrope ExtraBold ≈ the same vibe.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-fitnessblog',
  display: 'swap',
});

// Design tokens captured from the rendered Wix preview.
const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F2F1EC', // soft beige used behind cards
    ink: '#111111', // pure-near-black headlines + footer
    inkSoft: '#262626',
    muted: '#6B6B6B',
    accent: '#E8F557', // signature lime-yellow — the hero underline + tiles
    accentDeep: '#C5D63A',
    line: '#E5E4DF',
    photoBlue: '#7CA9C7', // pale blue used on the "Pushing yourself" tile
  },
  radius: { tile: 14, pill: 9999, button: 12 },
} as const;

export function WellnessFitnessBlogLanding({ store, products }: Props) {
  const accent =
    store.accentColor || store.primaryColor || theme.colors.accent;
  const ink = theme.colors.ink;

  // Hero image and the two featured photo cards. Wix uses three different
  // photographs; we tap into lifestyleImages first, then fall back to the
  // top of the product catalogue.
  const featuredImages: Array<string | null> = [
    store.lifestyleImages[0] ||
      products[0]?.thumbnail ||
      products[0]?.images?.[0]?.url ||
      store.heroImageUrl,
    store.lifestyleImages[1] ||
      products[1]?.thumbnail ||
      products[1]?.images?.[0]?.url ||
      store.cutoutImageUrl,
  ];

  // Hero wordmark — Wix renders the store name in a script-flavoured
  // logotype. We can't ship a custom display face here, so we render the
  // store name in heavy Manrope and underline the second half with the
  // lime accent to keep the signature gesture.
  const wordmark = (store.name || 'Maison').trim();
  const heroHeadline = buildHeroHeadline(store);

  // Featured posts heading + lede. Falls back to `landingContent.hero` or
  // a niche-driven copy block.
  const featuredKicker =
    store.landingContent?.hero?.kicker || `POSTS À L'AFFICHE`;
  const featuredLede =
    store.landingContent?.hero?.lede ||
    store.description ||
    `Tout sur ${store.niche || store.name}, sélectionné par l'équipe.`;

  // Three category bands. Wix uses three blog topics; we map them to the
  // landingContent.selling_points (when present) or to three sensible
  // catalogue slices.
  const points = (store.landingContent?.selling_points || []).slice(0, 3);
  const bands: Band[] = buildBands(points, products, accent);

  const fastAdd = products[0];
  const fastAddVariant = fastAdd?.variants?.[0];

  return (
    <div
      className={manrope.variable}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-fitnessblog), Manrope, sans-serif',
      }}
    >
      {/* ============== NAV — wordmark left + bag right ============== */}
      <header
        className="relative z-10 px-6 sm:px-10 py-5 border-b"
        style={{ borderColor: theme.colors.line }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Link href={`/shop/${store.slug}`} className="relative inline-block">
            <span
              className="text-2xl font-extrabold tracking-tight relative"
              style={{ color: ink }}
            >
              {wordmark}
              <span
                aria-hidden
                className="absolute left-0 right-0 bottom-1 h-2 -z-10"
                style={{
                  backgroundColor: accent,
                  transform: 'skewX(-12deg)',
                  borderRadius: theme.radius.pill,
                }}
              />
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-[12px] uppercase tracking-[0.18em] font-medium">
            <span style={{ color: ink }}>Accueil</span>
            <span style={{ color: theme.colors.muted }}>Boutique</span>
            <span style={{ color: theme.colors.muted }}>L&apos;histoire</span>
            <span style={{ color: theme.colors.muted }}>Contact</span>
          </nav>
          <span
            className="hidden sm:inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] font-medium px-3 py-1.5"
            style={{
              backgroundColor: ink,
              color: theme.colors.bg,
              borderRadius: theme.radius.pill,
            }}
          >
            Panier · 0
          </span>
        </div>
      </header>

      {/* ============== HERO — heavy sans headline + bold lime accent =====*/}
      <section
        className="relative px-6 sm:px-10 pt-16 pb-12 overflow-hidden"
        style={{ backgroundColor: theme.colors.bg }}
      >
        <div className="max-w-6xl mx-auto">
          <h1
            className="font-extrabold tracking-tight leading-[0.95]"
            style={{
              color: ink,
              fontSize: 'clamp(3rem, 9vw, 7rem)',
            }}
          >
            <span className="block">{heroHeadline[0]}</span>
            <span className="block relative inline-block">
              {heroHeadline[1]}
              <span
                aria-hidden
                className="absolute left-0 right-0 bottom-2 h-4 -z-10"
                style={{
                  backgroundColor: accent,
                  transform: 'skewX(-12deg)',
                  borderRadius: theme.radius.pill,
                }}
              />
            </span>
          </h1>
          <p
            className="mt-8 max-w-xl text-base sm:text-lg font-light leading-[1.6]"
            style={{ color: theme.colors.inkSoft }}
          >
            {store.tagline || featuredLede}
          </p>
        </div>
      </section>

      {/* ============== FEATURED POSTS STRIP — 2 photo cards ============= */}
      <section className="px-6 sm:px-10 pb-16">
        <div className="max-w-6xl mx-auto">
          <div
            className="flex items-center gap-4 mb-6 px-4 py-3"
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.tile,
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <p
              className="text-[12px] uppercase tracking-[0.32em] font-bold"
              style={{ color: ink }}
            >
              {featuredKicker}
            </p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featuredImages.map((src, i) => {
              const product = products[i];
              return (
                <li key={i}>
                  <Link
                    href={
                      product
                        ? `/shop/${store.slug}/products/${product.handle}`
                        : `/shop/${store.slug}`
                    }
                    className="group block relative overflow-hidden aspect-[4/3]"
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.tile,
                    }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={product?.title || store.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
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
                    <div
                      className="absolute left-4 top-4 px-3 py-1.5 text-[11px] uppercase tracking-[0.28em] font-bold"
                      style={{
                        backgroundColor: i === 0 ? accent : '#FFFFFF',
                        color: ink,
                        borderRadius: theme.radius.pill,
                      }}
                    >
                      {i === 0 ? 'Featured' : (store.niche || 'Boutique').toUpperCase()}
                    </div>
                    <div
                      className="absolute left-4 right-16 bottom-4 px-4 py-3 backdrop-blur-sm"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.88)',
                        borderRadius: theme.radius.tile,
                      }}
                    >
                      <p
                        className="text-sm font-bold tracking-tight leading-snug"
                        style={{ color: ink }}
                      >
                        {product?.title || `${store.name} — la sélection`}
                      </p>
                    </div>
                    <div
                      className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center text-base font-bold"
                      style={{
                        backgroundColor: accent,
                        color: ink,
                        borderRadius: theme.radius.pill,
                      }}
                      aria-hidden
                    >
                      →
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ============== CATEGORY BANDS — three vertical sections ========== */}
      {bands.map((band, idx) => (
        <section key={idx} className="px-6 sm:px-10 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <div
                  className="inline-flex items-center gap-3 px-3 py-1.5 mb-3"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <p
                    className="text-[11px] uppercase tracking-[0.32em] font-bold"
                    style={{ color: ink }}
                  >
                    {band.kicker}
                  </p>
                </div>
                <p
                  className="text-sm font-light"
                  style={{ color: theme.colors.muted }}
                >
                  {band.subline}
                </p>
              </div>
              <Link
                href={`/shop/${store.slug}`}
                className="hidden sm:inline-block px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] font-bold"
                style={{
                  backgroundColor: ink,
                  color: theme.colors.bg,
                  borderRadius: theme.radius.pill,
                }}
              >
                Voir plus
              </Link>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Editorial / colour tile — yellow when accent is the lime, else
                  uses the band tint. Carries the band headline / body. */}
              <li
                className="p-7 flex flex-col justify-between min-h-[280px]"
                style={{
                  backgroundColor: band.tint,
                  borderRadius: theme.radius.tile,
                  color: ink,
                }}
              >
                <div>
                  <p
                    className="text-[11px] uppercase tracking-[0.32em] font-bold mb-3"
                    style={{ color: ink }}
                  >
                    {band.kicker}
                  </p>
                  <h3
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.05]"
                    style={{ color: ink }}
                  >
                    {band.headline}
                  </h3>
                </div>
                <p
                  className="text-sm font-medium mt-5"
                  style={{ color: theme.colors.inkSoft }}
                >
                  {band.body}
                </p>
              </li>
              {/* Photo tile — pulls from a real product or lifestyle image. */}
              <li
                className="relative overflow-hidden aspect-[4/3]"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.tile,
                }}
              >
                {band.image ? (
                  <Link
                    href={
                      band.linkHandle
                        ? `/shop/${store.slug}/products/${band.linkHandle}`
                        : `/shop/${store.slug}`
                    }
                    className="group block w-full h-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={band.image}
                      alt={band.headline}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                    />
                    <div
                      className="absolute left-4 right-4 bottom-4 px-4 py-3"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        borderRadius: theme.radius.tile,
                      }}
                    >
                      <p
                        className="text-sm font-bold tracking-tight"
                        style={{ color: ink }}
                      >
                        {band.linkTitle}
                      </p>
                      {band.linkMeta && (
                        <p
                          className="mt-0.5 text-[11px] font-medium tabular-nums"
                          style={{ color: theme.colors.muted }}
                        >
                          {band.linkMeta}
                        </p>
                      )}
                    </div>
                  </Link>
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
            </ul>
          </div>
        </section>
      ))}

      {/* ============== SOCIAL RAIL — A L'AFFICHE DANS ==================== */}
      <section className="px-6 sm:px-10 pb-20">
        <div className="max-w-6xl mx-auto">
          <div
            className="flex items-center gap-4 mb-6 px-4 py-3"
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.tile,
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <p
              className="text-[12px] uppercase tracking-[0.32em] font-bold"
              style={{ color: ink }}
            >
              À l&apos;affiche dans
            </p>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => {
              const src =
                store.lifestyleImages[i] ||
                products[(i + 2) % Math.max(1, products.length)]?.thumbnail;
              return (
                <li
                  key={i}
                  className="relative aspect-square overflow-hidden"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.tile,
                  }}
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
                      className="absolute inset-0 flex items-center justify-center text-3xl"
                      style={{ color: theme.colors.muted }}
                      aria-hidden
                    >
                      {store.logoEmoji || '◇'}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ============== FAST-ADD CTA ==================================== */}
      {fastAdd && fastAddVariant && (
        <section
          className="px-6 sm:px-10 py-20 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-bold mb-4"
            style={{ color: theme.colors.muted }}
          >
            Notre signature
          </p>
          <h2
            className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto leading-[1.05]"
            style={{ color: ink }}
          >
            {fastAdd.title}
          </h2>
          <div className="mt-10 max-w-xs mx-auto">
            <AddToCartButton
              variantId={fastAddVariant.id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== FOOTER — pure black with lime wordmark ============ */}
      <footer
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: ink, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="relative inline-block">
              <span className="text-3xl font-extrabold tracking-tight relative">
                {wordmark}
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-1 h-2 -z-10"
                  style={{
                    backgroundColor: accent,
                    transform: 'skewX(-12deg)',
                    borderRadius: theme.radius.pill,
                  }}
                />
              </span>
            </div>
            <p
              className="mt-6 text-sm font-light leading-[1.85] max-w-xs"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {truncate(store.description || featuredLede, 180)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.32em] font-bold mb-4"
                style={{ color: accent }}
              >
                Boutique
              </p>
              <ul
                className="space-y-2 text-sm font-light"
                style={{ color: 'rgba(255,255,255,0.78)' }}
              >
                <li>Nouveautés</li>
                <li>Best-sellers</li>
                <li>L&apos;équipe</li>
                <li>Histoire</li>
              </ul>
            </div>
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.32em] font-bold mb-4"
                style={{ color: accent }}
              >
                Aide
              </p>
              <ul
                className="space-y-2 text-sm font-light"
                style={{ color: 'rgba(255,255,255,0.78)' }}
              >
                <li>Livraison</li>
                <li>Retours</li>
                <li>Contact</li>
                <li>FAQ</li>
              </ul>
            </div>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-bold mb-4"
              style={{ color: accent }}
            >
              Newsletter
            </p>
            <p
              className="text-sm font-light mb-5"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              Conseils et nouveautés une fois par semaine.
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
                aria-label="Email"
                className="flex-1 px-4 py-2.5 text-sm font-light bg-transparent border outline-none placeholder:opacity-50"
                style={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#FFFFFF',
                  borderRadius: theme.radius.pill,
                }}
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] font-bold"
                style={{
                  backgroundColor: accent,
                  color: ink,
                  borderRadius: theme.radius.pill,
                }}
              >
                Ok
              </button>
            </form>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto mt-12 pt-6 text-xs font-light flex flex-col sm:flex-row sm:justify-between gap-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <p>
            © {new Date().getFullYear()} {store.name}. Tous droits réservés.
          </p>
          <p className="uppercase tracking-[0.28em]">
            {store.niche || 'Lifestyle'}
          </p>
        </div>
      </footer>
    </div>
  );
}

interface Band {
  kicker: string;
  subline: string;
  headline: string;
  body: string;
  tint: string;
  image?: string | null;
  linkTitle: string;
  linkMeta?: string | null;
  linkHandle?: string | null;
}

/** Wix categorises the blog into FITNESS / NUTRITION / MOTIVATION. We
 * mirror the three-band cadence using landingContent selling points when
 * available, falling back to a derived trio that always reads in French. */
function buildBands(
  points: Array<{ title: string; body: string }>,
  products: WellnessFitnessBlogProduct[],
  accent: string,
): Band[] {
  const fallbackTints = [accent, '#F2F1EC', '#1A1A1A'];
  const defaultKickers = ['FITNESS', 'NUTRITION', 'MOTIVATION'];
  const defaultSublines = [
    'Le secret pour un entraînement réussi',
    'Nos conseils pour une alimentation saine',
    "Tout ce que tu dois savoir pour avancer",
  ];
  const fallbackBodies = [
    'Trois mouvements à intégrer dans la routine de la semaine.',
    'Une assiette équilibrée, simple et accessible.',
    'Cinq leviers concrets pour rester sur le rythme.',
  ];

  return [0, 1, 2].map((i) => {
    const p = points[i];
    const product = products[i + 2] || products[i] || products[0];
    const variant = product?.variants?.[0];
    const price = variant?.calculated_price?.calculated_amount;
    const currency =
      variant?.calculated_price?.currency_code || 'eur';
    return {
      kicker: (p?.title || defaultKickers[i]).toUpperCase(),
      subline: defaultSublines[i],
      headline: p?.title || defaultKickers[i],
      body: p?.body || fallbackBodies[i],
      tint: fallbackTints[i],
      image: product?.thumbnail || product?.images?.[0]?.url || null,
      linkTitle: product?.title || `Sélection ${defaultKickers[i].toLowerCase()}`,
      linkMeta:
        price !== undefined ? formatMoney(price, currency) : null,
      linkHandle: product?.handle || null,
    };
  });
}

/**
 * Build a two-line heavy sans hero ("Reste / En Mouv'"). Uses the tagline
 * when it's short enough to split, otherwise the store name with a
 * niche-aware second line.
 */
function buildHeroHeadline(store: StoreConfig): [string, string] {
  const tagline = (store.tagline || '').trim();
  if (tagline) {
    const words = tagline.split(/\s+/);
    if (words.length >= 2 && words.length <= 6) {
      const half = Math.ceil(words.length / 2);
      return [
        words.slice(0, half).join(' '),
        words.slice(half).join(' '),
      ];
    }
    if (tagline.length <= 22) {
      return ['Reste', tagline];
    }
  }
  const n = (store.niche || '').toLowerCase();
  if (n.includes('fitness') || n.includes('sport')) {
    return ['Reste', 'En Mouv'];
  }
  if (n.includes('nutrition') || n.includes('food')) {
    return ['Bien', 'Manger'];
  }
  const name = (store.name || 'Maison').trim();
  return ['Bienvenue', name];
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
