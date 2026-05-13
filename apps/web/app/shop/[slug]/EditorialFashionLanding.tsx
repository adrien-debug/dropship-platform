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

export interface EditorialFashionProduct {
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
  products: EditorialFashionProduct[];
}

/**
 * Editorial Fashion Landing — port of the Wix "Boutique de vêtements" (Ann
 * Simon) template (https://fr.wix.com/website-template/view/html/2068).
 *
 * Design grammar lifted from the source:
 *   - Off-white background, deep charcoal (#2F2E2E) ink, soft grey rules.
 *   - Playfair Display for monumental serif display (160px brand mark),
 *     Inter as the helvetica-w01-light stand-in for body / labels.
 *   - Hero is a full-bleed lifestyle portrait with a "logotype-over-photo"
 *     treatment — the store name composes against the model image.
 *   - A two-column tile strip with model photos and overlay button cards
 *     replaces the Wix "New Collection" / "Sale" panels — here it surfaces
 *     real products from the catalog instead of seasonal mockups.
 *   - Full-bleed editorial banner moment, then an "Instagram" trio of
 *     squares pulled from the store's lifestyle photo pool.
 *
 * Every piece of copy is wired to `store.*` props so a fashion store, a
 * cosmetics store, or a streetwear store can all reuse the same scaffold
 * without hardcoding a niche. The Wix tan accent (`rgb(222,80,33)`) is
 * threaded through `theme.colors.accent` and overridden by
 * `store.primaryColor` / `store.accentColor` when present.
 */

// next/font/google — loaded once at the template module so the bundle is
// CLS-free and we never reach for the proprietary Wix fonts.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-editorial-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-editorial-body',
  display: 'swap',
});

// Design tokens captured from the Wix template. The accent + ink can be
// overridden per-store by passing `store.primaryColor` / `store.accentColor`
// downstream (see `accent` resolution in the render).
const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F6F4F1',
    ink: '#2F2E2E',
    muted: '#A0A09F',
    line: '#605E5E',
    accent: '#DE5021', // Wix --wst-color-custom-13
    cream: '#F4EAB1', // Wix --wst-color-custom-16
    sage: '#B6E8E3', // Wix --wst-color-custom-6
  },
  radius: { button: 0, card: 0, pill: 9999 },
} as const;

export function EditorialFashionLanding({ store, products }: Props) {
  // The Wix accent is just a fallback — every generated store can override.
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const ink = theme.colors.ink;

  // The brand mark trick — Wix splits "Ann" into a tall A overlaying the
  // portrait and "nn" set above it. We mimic by extracting the first letter
  // and the rest of the first word, falling back to two-letter monograms.
  const brand = splitBrandMark(store.name);

  // Hero image fallback chain: hero asset → first product photo → cutout.
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Two-up tile strip = first two products (mirrors the "New Collection" /
  // "Sale" cards). If the store has fewer than 2 SKUs we still render one.
  const tileProducts = products.slice(0, 2);

  // Editorial banner image — prefer a lifestyle, else the cutout.
  const bannerImage = store.lifestyleImages[0] ?? store.cutoutImageUrl ?? null;

  // Instagram trio — three lifestyle photos. We pad with the hero image if
  // the store hasn't generated enough lifestyles yet (avoids empty squares).
  const insta = padTo3([...store.lifestyleImages], heroImage);

  // Final products grid — anything past the tile strip lives here.
  const restProducts = products.slice(2);

  return (
    <div
      className={`${playfair.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-editorial-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — minimal, centered logotype ============== */}
      <header
        className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b"
        style={{ borderColor: '#EDEAE4' }}
      >
        <Link
          href={`/shop/${store.slug}`}
          className="text-xs uppercase tracking-[0.36em]"
          style={{ color: ink }}
        >
          {store.name}
        </Link>
        <nav className="hidden sm:flex items-center gap-8 text-xs uppercase tracking-[0.28em]">
          <span style={{ color: theme.colors.muted }}>Boutique</span>
          <span style={{ color: theme.colors.muted }}>Lookbook</span>
          <span style={{ color: theme.colors.muted }}>Contact</span>
        </nav>
        <div className="flex items-center gap-5 text-xs uppercase tracking-[0.28em]">
          <span style={{ color: theme.colors.muted }} className="hidden sm:inline">
            Connexion
          </span>
          <span aria-label="Panier" style={{ color: ink }}>
            Panier (0)
          </span>
        </div>
      </header>

      {/* ============== HERO — portrait + serif logotype overlay ============== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:aspect-[16/8]">
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
              style={{ color: theme.colors.muted }}
              aria-hidden
            >
              {store.logoEmoji || '◇'}
            </div>
          )}

          {/* Logotype overlay — Playfair, brand mark composed on the right */}
          <div className="absolute inset-0 flex items-center justify-end pr-6 sm:pr-16 md:pr-24">
            <div
              className="text-right"
              style={{
                fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
                color: '#FFFFFF',
                mixBlendMode: 'difference',
              }}
            >
              {brand.tail && (
                <span
                  className="block font-bold leading-[0.9] tracking-[-0.02em]"
                  style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
                >
                  {brand.tail}
                </span>
              )}
              <span
                className="block font-bold leading-[0.85] tracking-[-0.04em]"
                style={{ fontSize: 'clamp(7rem, 18vw, 14rem)' }}
              >
                {brand.head}
              </span>
            </div>
          </div>
        </div>

        {/* Thin charcoal rule under the hero — Wix uses a single dark band */}
        <div className="w-full h-2" style={{ backgroundColor: ink }} />
      </section>

      {/* ============== KICKER / STORE DESCRIPTION ============== */}
      <section className="px-6 sm:px-10 pt-20 sm:pt-28 pb-12 max-w-3xl mx-auto text-center">
        <p
          className="text-[11px] uppercase tracking-[0.36em] mb-6"
          style={{ color: theme.colors.muted }}
        >
          {store.niche}
        </p>
        <p
          className="text-lg sm:text-xl leading-[1.6]"
          style={{
            fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
            color: ink,
          }}
        >
          {store.description ||
            store.tagline ||
            `${store.name} compose une garde-robe pensée pour durer, pièce après pièce.`}
        </p>
        {products[0] && (
          <div className="mt-10">
            <Link
              href={`/shop/${store.slug}/products/${products[0].handle}`}
              className="inline-block text-[11px] uppercase tracking-[0.36em] pb-2 border-b transition-opacity hover:opacity-60"
              style={{ color: ink, borderColor: ink }}
            >
              Découvrir la boutique
            </Link>
          </div>
        )}
      </section>

      {/* ============== TILE STRIP — two product showcase cards ============== */}
      {tileProducts.length > 0 && (
        <section className="px-6 sm:px-10 pb-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
            {tileProducts.map((product, idx) => {
              const image = product.thumbnail || product.images?.[0]?.url;
              // Each tile alternates between an "ink on cream" plate and a
              // "ink on sage" plate so the two cards read as a diptych.
              const plate = idx === 0 ? theme.colors.cream : theme.colors.sage;
              const variant = product.variants?.[0];
              const price = variant?.calculated_price?.calculated_amount;
              const currency = variant?.calculated_price?.currency_code || 'eur';
              const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
              return (
                <Link
                  key={product.id}
                  href={`/shop/${store.slug}/products/${product.handle}`}
                  className="group relative block aspect-[4/5] overflow-hidden"
                  style={{ backgroundColor: plate }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={product.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-6xl"
                      style={{ color: ink, opacity: 0.25 }}
                      aria-hidden
                    >
                      {store.logoEmoji || '◇'}
                    </div>
                  )}
                  {/* Overlay button card — Wix calls this "Shop New Collection / Sale" */}
                  <div
                    className="absolute left-1/2 bottom-10 -translate-x-1/2 min-w-[55%] px-8 py-4 text-center"
                    style={{ backgroundColor: '#FFFFFF', color: ink }}
                  >
                    <p
                      className="text-base sm:text-lg font-bold tracking-tight"
                      style={{
                        fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
                      }}
                    >
                      {product.title}
                    </p>
                    {formattedPrice && (
                      <p
                        className="mt-1 text-[11px] uppercase tracking-[0.32em] tabular-nums"
                        style={{ color: theme.colors.muted }}
                      >
                        {formattedPrice}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ============== EDITORIAL BANNER ============== */}
      {bannerImage ? (
        <section className="relative w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerImage}
            alt=""
            className="w-full h-[42vh] sm:h-[52vh] object-cover"
          />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(47,46,46,0.18)' }}
          >
            <Link
              href={products[0] ? `/shop/${store.slug}/products/${products[0].handle}` : `/shop/${store.slug}`}
              className="inline-block px-10 py-4 text-[11px] uppercase tracking-[0.36em] transition-colors"
              style={{ backgroundColor: '#FFFFFF', color: ink }}
            >
              {store.tagline ? truncate(store.tagline, 28) : 'Voir la collection'}
            </Link>
          </div>
        </section>
      ) : (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.36em] mb-4"
            style={{ color: theme.colors.muted }}
          >
            Édition courante
          </p>
          <p
            className="text-2xl sm:text-3xl max-w-2xl mx-auto leading-[1.3]"
            style={{
              fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
              color: ink,
            }}
          >
            {store.tagline || 'Des pièces choisies, portées longtemps.'}
          </p>
        </section>
      )}

      {/* ============== REST OF CATALOG — bare grid ============== */}
      {restProducts.length > 0 && (
        <section className="px-6 sm:px-10 py-24 max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between mb-12">
            <h2
              className="text-3xl sm:text-4xl tracking-tight"
              style={{
                fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
                color: ink,
              }}
            >
              Le reste
            </h2>
            <p
              className="text-[11px] uppercase tracking-[0.32em] tabular-nums"
              style={{ color: theme.colors.muted }}
            >
              {restProducts.length} pièce{restProducts.length > 1 ? 's' : ''}
            </p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
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
                      className="relative aspect-[4/5] overflow-hidden mb-4"
                      style={{ backgroundColor: theme.colors.surface }}
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
                    </div>
                    <p
                      className="text-base font-medium leading-tight"
                      style={{
                        fontFamily:
                          'var(--font-editorial-display), "Playfair Display", serif',
                        color: ink,
                      }}
                    >
                      {product.title}
                    </p>
                    {formattedPrice && (
                      <p
                        className="mt-1 text-[11px] uppercase tracking-[0.32em] tabular-nums"
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
        </section>
      )}

      {/* ============== CTA STRIP — single product fast-add ============== */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-20 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.36em] mb-5"
            style={{ color: accent }}
          >
            Coup de cœur
          </p>
          <h2
            className="text-3xl sm:text-5xl tracking-tight max-w-2xl mx-auto"
            style={{
              fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
              color: ink,
            }}
          >
            {products[0].title}
          </h2>
          <div className="mt-8 max-w-xs mx-auto">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== "INSTAGRAM" TRIO ============== */}
      <section className="px-6 sm:px-10 py-24 max-w-7xl mx-auto text-center">
        <p
          className="text-[11px] uppercase tracking-[0.36em] mb-3"
          style={{ color: theme.colors.muted }}
        >
          Suivez la maison
        </p>
        <h2
          className="text-3xl sm:text-4xl tracking-tight mb-12"
          style={{
            fontFamily: 'var(--font-editorial-display), "Playfair Display", serif',
            color: ink,
          }}
        >
          @{slugifyHandle(store.name)}
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4">
          {insta.map((src, idx) => (
            <li key={idx} className="relative aspect-square overflow-hidden">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-4xl"
                  style={{
                    color: theme.colors.muted,
                    backgroundColor: theme.colors.surface,
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

      {/* ============== FOOTER ============== */}
      <footer
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: ink, color: '#FFFFFF' }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-20 items-start">
          <div>
            <p
              className="text-xs uppercase tracking-[0.36em] mb-5"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Maison
            </p>
            <ul className="space-y-2 text-sm">
              <li>Contact</li>
              <li>Points de vente</li>
              <li>FAQ</li>
              <li>Livraison et retours</li>
              <li>Conditions de vente</li>
              <li>Moyens de paiement</li>
            </ul>
          </div>
          <div>
            <p
              className="text-xs uppercase tracking-[0.36em] mb-5"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Newsletter
            </p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Recevez les nouvelles pièces avant tout le monde, une fois par mois.
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
                className="flex-1 px-4 py-3 text-sm bg-transparent border outline-none placeholder:opacity-60"
                style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF' }}
              />
              <button
                type="submit"
                className="px-6 py-3 text-xs uppercase tracking-[0.32em] transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#FFFFFF', color: ink }}
              >
                S&apos;inscrire
              </button>
            </form>
          </div>
        </div>
        <div
          className="max-w-7xl mx-auto mt-16 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
          style={{
            borderColor: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <p>
            © {new Date().getFullYear()} {store.name}. Tous droits réservés.
          </p>
          <p className="uppercase tracking-[0.32em]">
            Powered by {store.name}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Wix template splits the brand name into "first letter" (very large) and
 * "rest of first word" (smaller above). For two-word names we keep the
 * second word out of the mark to avoid crowding the portrait.
 */
function splitBrandMark(name: string): { head: string; tail: string } {
  const trimmed = name.trim();
  if (!trimmed) return { head: '·', tail: '' };
  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord.length === 1) return { head: firstWord, tail: '' };
  return { head: firstWord[0], tail: firstWord.slice(1).toLowerCase() };
}

/** Pad an image array to length 3 with a fallback URL or empty slot. */
function padTo3(arr: Array<string | null | undefined>, fallback?: string | null | undefined) {
  const out: Array<string | null> = arr.filter((u): u is string => typeof u === 'string').slice(0, 3);
  while (out.length < 3) {
    out.push(typeof fallback === 'string' ? fallback : null);
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function slugifyHandle(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18) || 'lamaison';
}
