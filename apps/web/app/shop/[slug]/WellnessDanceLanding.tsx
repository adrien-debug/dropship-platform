import Link from 'next/link';
import { Jockey_One, Inter } from 'next/font/google';
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

export interface WellnessDanceProduct {
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
  products: WellnessDanceProduct[];
}

/**
 * Wellness Dance Landing — port of the Wix "Cours de danse en ligne"
 * template (https://fr.wix.com/website-template/view/html/3059,
 * health-wellness category).
 *
 * Design grammar lifted from the source:
 *   - Playful, energetic dance studio. Hero is a cyan plate `#7FC9E3`
 *     with a cutout-style action photo on the right and a small bold
 *     italic kicker on the left ("DANS LE MOUV...") and a small purple
 *     pill CTA.
 *   - The page is a stack of alternating pastel bands: cyan, peach,
 *     lavender, dark navy. Each band has its own H2 set in Jockey One
 *     (120px Wix size) — uppercase, geometric, slightly playful.
 *   - "FONCTIONNEMENT" features a phone mockup with bullet points; we
 *     re-frame it as the "Notre univers" trust block on a cream plate.
 *   - "STYLES" is a 3-up tile grid; we use it as the product grid.
 *   - "COURS À LA DEMANDE" is a 3-photo lifestyle strip; we use
 *     `store.lifestyleImages` or fall back to the product images.
 *   - "RENCONTREZ VOS INSTRUCTEURS" is a 4-up grid of muted card
 *     placeholders; we re-frame it as a feature row (story / promise /
 *     livraison / contact) sourced from store metadata.
 *   - Dark navy footer.
 *
 * Every accent honours `store.primaryColor` (cyan → brand) and
 * `store.accentColor` (purple → brand accent) when present.
 */

const jockey = Jockey_One({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dance-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dance-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    ink: '#101013', // near-black — H1, body
    inkSoft: '#3C3C45',
    cyan: '#A3DDEC', // hero plate
    cyanDeep: '#7FC9E3',
    peach: '#F8C6B0', // tile band
    lavender: '#C4B6E8', // gradient mid
    violet: '#8244BD', // CTA accent — Wix subscribe button
    cream: '#F5F1EA',
    muted: '#7A7A82',
    line: '#E5E1DA',
    dark: '#16161A', // footer
  },
  radius: { pill: 9999, card: 10 },
} as const;

export function WellnessDanceLanding({ store, products }: Props) {
  const accent = store.accentColor || theme.colors.violet;
  const brandFill = store.primaryColor || theme.colors.cyanDeep;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Three-up "STYLES" product grid + a 3-photo "COURS À LA DEMANDE"
  // lifestyle strip. We use up to 3 products for the grid and the next
  // 3 lifestyle images (or product images) for the strip.
  const gridProducts = products.slice(0, 3);
  const lifestyleStrip = padArray(
    [
      ...store.lifestyleImages,
      ...products.slice(0, 6).map((p) => p.thumbnail || p.images?.[0]?.url || null),
    ].filter(Boolean) as string[],
    3,
    null,
  );

  // 4-up "RENCONTREZ VOS INSTRUCTEURS" feature grid — re-framed as four
  // brand promise tiles.
  const promises = buildPromises(store);

  return (
    <div
      className={`${jockey.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-dance-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — bold, square ================================ */}
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
            className="text-2xl uppercase"
            style={{
              color: ink,
              fontFamily: 'var(--font-dance-display), sans-serif',
              letterSpacing: '0.01em',
            }}
          >
            {store.name}
          </Link>
          <nav
            className="hidden sm:flex items-center gap-6 text-[12px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: inkSoft }}
          >
            <span style={{ color: ink }}>Accueil</span>
            <span>Boutique</span>
            <span>L&apos;univers</span>
            <span>Contact</span>
          </nav>
          <Link
            href={`/shop/${store.slug}#newsletter`}
            className="hidden sm:inline-flex items-center px-4 py-2 text-[11px] uppercase tracking-[0.18em] font-semibold"
            style={{
              backgroundColor: accent,
              color: '#FFFFFF',
              borderRadius: theme.radius.card,
            }}
          >
            S&apos;abonner
          </Link>
        </div>
      </header>

      {/* ============== HERO — cyan plate + cutout photo ================== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: brandFill }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 max-w-7xl mx-auto px-6 sm:px-10 pt-14 pb-20 md:py-24 gap-8 items-center">
          <div className="md:col-span-6">
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-4"
              style={{ color: ink }}
            >
              {store.niche || 'Mouvement'} · Édition 2026
            </p>
            <h1
              className="uppercase italic"
              style={{
                color: ink,
                fontFamily: 'var(--font-dance-display), sans-serif',
                fontSize: 'clamp(3rem, 9vw, 8.5rem)',
                fontWeight: 400,
                lineHeight: 0.9,
                letterSpacing: '-0.01em',
              }}
            >
              {buildHeroPhrase(store)}
            </h1>
            <p
              className="mt-6 max-w-md text-sm sm:text-base font-medium leading-[1.6]"
              style={{ color: ink }}
            >
              {store.tagline ||
                store.description ||
                `${store.name} — la sélection ${store.niche || 'bien-être'} pour celles et ceux qui veulent rester dans le mouv'.`}
            </p>
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-flex mt-9 px-7 py-3 text-[12px] uppercase tracking-[0.22em] font-bold"
                style={{
                  backgroundColor: accent,
                  color: '#FFFFFF',
                  borderRadius: theme.radius.card,
                }}
              >
                Commencer
              </Link>
            )}
          </div>
          <div className="md:col-span-6 relative">
            <div
              className="relative aspect-square overflow-hidden"
              style={{
                backgroundColor: 'transparent',
                borderRadius: theme.radius.card,
              }}
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
                  style={{ color: ink }}
                  aria-hidden
                >
                  {store.logoEmoji || '◇'}
                </div>
              )}
              {/* Pastel halftone disc — Wix layered a white sun behind the photo */}
              <div
                aria-hidden
                className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full"
                style={{ backgroundColor: theme.colors.peach, opacity: 0.55 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============== FONCTIONNEMENT — cream plate + promises =========== */}
      <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.cream }}>
        <div className="max-w-6xl mx-auto text-center">
          <h2
            className="uppercase mb-14"
            style={{
              color: ink,
              fontFamily: 'var(--font-dance-display), sans-serif',
              fontSize: 'clamp(2.5rem, 7vw, 7rem)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 0.95,
            }}
          >
            Fonctionnement
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {promises.slice(0, 3).map((p, idx) => (
              <li
                key={idx}
                className="p-7"
                style={{
                  backgroundColor: theme.colors.bg,
                  borderRadius: theme.radius.card,
                  border: `1px solid ${theme.colors.line}`,
                }}
              >
                <p
                  className="text-3xl mb-4"
                  style={{
                    color: accent,
                    fontFamily: 'var(--font-dance-display), sans-serif',
                  }}
                >
                  0{idx + 1}
                </p>
                <p
                  className="text-base font-bold mb-3 uppercase tracking-[0.08em]"
                  style={{ color: ink }}
                >
                  {p.title}
                </p>
                <p className="text-sm font-light leading-[1.8]" style={{ color: inkSoft }}>
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== STYLES — 3-up product grid on peach plate ========= */}
      {gridProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.peach }}>
          <div className="max-w-6xl mx-auto text-center">
            <h2
              className="uppercase mb-3"
              style={{
                color: ink,
                fontFamily: 'var(--font-dance-display), sans-serif',
                fontSize: 'clamp(2.5rem, 7vw, 7rem)',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                lineHeight: 0.95,
              }}
            >
              Styles
            </h2>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-14"
              style={{ color: inkSoft }}
            >
              Maîtrisez les codes et les classiques
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
                      className="group block"
                      style={{
                        backgroundColor: theme.colors.cyanDeep,
                        borderRadius: theme.radius.card,
                        overflow: 'hidden',
                      }}
                    >
                      <div className="relative aspect-[5/4] overflow-hidden">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-6xl"
                            style={{ color: theme.colors.bg }}
                            aria-hidden
                          >
                            {store.logoEmoji || '◇'}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-4 text-left">
                        <p
                          className="text-base font-bold uppercase tracking-[0.06em] truncate"
                          style={{ color: ink }}
                        >
                          {product.title}
                        </p>
                        {formattedPrice && (
                          <p
                            className="mt-1 text-xs font-medium tabular-nums"
                            style={{ color: inkSoft }}
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

      {/* ============== COURS À LA DEMANDE — 3-photo lifestyle strip ====== */}
      <section
        className="px-6 sm:px-10 py-24"
        style={{
          background: `linear-gradient(180deg, ${theme.colors.peach} 0%, ${theme.colors.lavender} 100%)`,
        }}
      >
        <div className="max-w-6xl mx-auto text-center">
          <h2
            className="uppercase mb-3"
            style={{
              color: ink,
              fontFamily: 'var(--font-dance-display), sans-serif',
              fontSize: 'clamp(2.5rem, 7vw, 7rem)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 0.95,
            }}
          >
            Cours à la demande
          </h2>
          <p
            className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-14"
            style={{ color: inkSoft }}
          >
            Avancez à votre rythme
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {lifestyleStrip.map((src, idx) => (
              <li
                key={idx}
                className="relative aspect-[4/5] overflow-hidden"
                style={{
                  backgroundColor: theme.colors.cyanDeep,
                  borderRadius: theme.radius.card,
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
                    className="absolute inset-0 flex items-center justify-center text-5xl"
                    style={{ color: theme.colors.bg }}
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

      {/* ============== RENCONTREZ VOS INSTRUCTEURS — 4-up promise grid === */}
      <section className="px-6 sm:px-10 py-24" style={{ backgroundColor: theme.colors.bg }}>
        <div className="max-w-6xl mx-auto text-center">
          <h2
            className="uppercase mb-3"
            style={{
              color: ink,
              fontFamily: 'var(--font-dance-display), sans-serif',
              fontSize: 'clamp(2.25rem, 6vw, 5.5rem)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 0.95,
            }}
          >
            Pourquoi nous
          </h2>
          <p
            className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-14"
            style={{ color: inkSoft }}
          >
            Rien que le meilleur pour vous
          </p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {promises.map((p, idx) => (
              <li
                key={idx}
                className="p-5"
                style={{
                  backgroundColor: theme.colors.cream,
                  borderRadius: theme.radius.card,
                }}
              >
                <div
                  className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full"
                  style={{
                    backgroundColor: idx % 2 === 0 ? brandFill : accent,
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-dance-display), sans-serif',
                  }}
                  aria-hidden
                >
                  {idx + 1}
                </div>
                <p
                  className="text-sm font-bold mb-2 uppercase tracking-[0.06em]"
                  style={{ color: ink }}
                >
                  {p.title}
                </p>
                <p className="text-xs font-light leading-[1.7]" style={{ color: inkSoft }}>
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== COMME VU SUR — dark band ========================== */}
      <section
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <p
            className="text-[11px] uppercase tracking-[0.42em] font-semibold mb-6"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Comme vu sur
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {['VOGUE', 'ELLE', 'L’ÉQUIPE', 'GLAMOUR', 'STYLIST'].map((label) => (
              <span
                key={label}
                className="text-sm tracking-[0.42em] uppercase font-light"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FAST-ADD CTA ====================================== */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.cyan }}
        >
          <h2
            className="uppercase mb-6"
            style={{
              color: ink,
              fontFamily: 'var(--font-dance-display), sans-serif',
              fontSize: 'clamp(2.25rem, 6vw, 5.5rem)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              lineHeight: 0.95,
            }}
          >
            Notre signature
          </h2>
          <p
            className="text-sm sm:text-base font-medium leading-[1.6] mb-9 max-w-xl mx-auto"
            style={{ color: ink }}
          >
            {products[0].title}
          </p>
          <div className="max-w-xs mx-auto">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== FOOTER — dark navy ================================ */}
      <footer
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <p
              className="text-2xl uppercase mb-4"
              style={{
                fontFamily: 'var(--font-dance-display), sans-serif',
              }}
            >
              {store.name}
            </p>
            <p
              className="text-sm font-light leading-[1.8] max-w-sm"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {truncate(
                store.description || `${store.name} — sélection ${store.niche || 'bien-être'}.`,
                160,
              )}
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-4"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Boutique
            </p>
            <ul className="space-y-2 text-sm font-light" style={{ color: 'rgba(255,255,255,0.75)' }}>
              <li>La sélection</li>
              <li>Nouveautés</li>
              <li>Best-sellers</li>
              <li>Contact</li>
            </ul>
          </div>
          <div id="newsletter">
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-4"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Newsletter
            </p>
            <form
              className="flex flex-col gap-2"
              action={`/shop/${store.slug}`}
              method="get"
            >
              <input
                type="email"
                required
                placeholder="votre@email.com"
                aria-label="Adresse email"
                className="px-3 py-2 text-sm font-light bg-transparent border outline-none placeholder:opacity-60"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#FFFFFF' }}
              />
              <button
                type="submit"
                className="px-4 py-2 text-[11px] uppercase tracking-[0.22em] font-bold"
                style={{ backgroundColor: accent, color: '#FFFFFF', borderRadius: theme.radius.card }}
              >
                S&apos;abonner
              </button>
            </form>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto pt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] font-light"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span>{store.niche || 'Mouvement'}</span>
        </div>
      </footer>
    </div>
  );
}

interface BrandPromise {
  title: string;
  body: string;
}

function buildPromises(store: StoreConfig): BrandPromise[] {
  const points = store.landingContent?.selling_points;
  const niche = store.niche || 'bien-être';
  if (Array.isArray(points) && points.length >= 4) {
    return points.slice(0, 4).map((p) => ({
      title: (p.title || '').trim(),
      body: (p.body || '').trim(),
    }));
  }
  return [
    {
      title: 'Inscription',
      body: `Créez votre compte ${store.name} en deux minutes. L'accès est immédiat.`,
    },
    {
      title: 'Sélection',
      body: `Une bibliothèque ${niche} montée à la main, sans copier-coller.`,
    },
    {
      title: 'À la demande',
      body: `Achetez quand vous voulez, livrez où vous voulez. Pas de calendrier.`,
    },
    {
      title: 'Suivi',
      body: `Une équipe ${store.name} attentive, joignable à tout moment.`,
    },
  ];
}

function buildHeroPhrase(store: StoreConfig): string {
  const tagline = (store.tagline || '').trim();
  if (tagline && tagline.length <= 22) return tagline.toUpperCase();
  const name = (store.name || 'La Maison').trim();
  if (name.length <= 18) return `Dans le ${name}...`.toUpperCase();
  return name.toUpperCase();
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
