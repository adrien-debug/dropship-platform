import Link from 'next/link';
import { Cormorant_Garamond, EB_Garamond } from 'next/font/google';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import type { StoreConfig } from '@/lib/store-config';

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: { calculated_amount: number; original_amount?: number; currency_code: string } | null;
}

export interface FioraLocksProduct {
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
  products: FioraLocksProduct[];
}

/**
 * Fiora Locks Landing — port of the Wix "Hair Extensions Salon (Fresh)"
 * template (https://www.wix.com/demone2/fiora-locks).
 *
 * Design grammar lifted from the source:
 *   - Off-white near-cream background, deep black ink, soft warm grey
 *     body text (#403F3D). High serif content, tight letter-spacing on
 *     the display ("plantin-mt-std" → Cormorant Garamond Light).
 *   - The brand mark is set in a 37px Cormorant Light at the top with the
 *     primary nav linking through small EB-Garamond italics.
 *   - Hero: tall serif headline ("The Length You've Longed For") + soft
 *     subtitle + a thin black-outline "Book Now" button + 2-image stack
 *     on the right (close-up + portrait).
 *   - "Find Your Perfect Match" 4-row service strip — each row is a left
 *     image, a serif title (24px), a sentence of body copy, and a small
 *     "Book Now" pill on the right.
 *   - "01 / 02 / 03 / 04 / 05" numbered colour list. Each row is a serif
 *     number, a colour swatch / product image, a serif name (24px) and a
 *     descriptive sentence.
 *   - "A Glimpse of the Glow-Up" — a large portrait + 3 small images
 *     gallery section. Centered title and CTA below.
 *   - "Words from Our Community" — 3-column testimonial cards.
 *   - "Ready for Your Transformation?" centred final CTA in serif.
 *   - 4-column footer: address, social links, nav, legal.
 *
 * Slot wiring: every piece of copy / image is `store.*` driven, so the
 * same scaffold can host a perfume line, a candle maison, or a leather
 * goods boutique while keeping the slow editorial cadence.
 */

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-fiora-display',
  display: 'swap',
});

const body = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fiora-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#F4F1EB', // cream off-white
    surface: '#FFFFFF',
    ink: '#000000', // deep black for serif display
    inkDeep: '#1E1D1C',
    body: '#403F3D', // muted body text grey
    muted: '#A09E99',
    line: '#D8D2C5',
  },
} as const;

export function FioraLocksLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.inkDeep;
  const ink = theme.colors.ink;
  const bodyColor = theme.colors.body;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url;
  const heroSide =
    store.cutoutImageUrl || products[1]?.thumbnail || products[1]?.images?.[0]?.url || heroImage;

  const services = buildServices(store, products);
  const colorRows = buildColorRows(store, products);
  const galleryProducts = products.slice(0, 4);

  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: bodyColor,
        fontFamily: 'var(--font-fiora-body), "EB Garamond", serif',
      }}
    >
      {/* ============== NAV — big serif logotype + centred links =========== */}
      <header className="px-6 sm:px-12 pt-10 pb-6 border-b" style={{ borderColor: theme.colors.line }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="block"
            style={{
              fontFamily: 'var(--font-fiora-display), "Cormorant Garamond", serif',
              color: ink,
              fontSize: 'clamp(2.1rem, 4vw, 2.6rem)',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {store.name}
          </Link>
          <nav className="flex items-center gap-7 text-base font-normal" style={{ color: ink }}>
            <span>Accueil</span>
            <span style={{ color: bodyColor }}>Univers</span>
            <span style={{ color: bodyColor }}>Galerie</span>
            <span style={{ color: bodyColor }}>Contact</span>
            <Link
              href={`/shop/${store.slug}`}
              className="px-5 py-2 border transition-colors hover:bg-black hover:text-white"
              style={{ borderColor: ink, color: ink }}
            >
              Réserver
            </Link>
          </nav>
        </div>
      </header>

      {/* ============== HERO — split serif headline + image stack ============ */}
      <section className="px-6 sm:px-12 pt-16 pb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-start">
          <div className="md:col-span-6">
            <h1
              className="mb-6"
              style={{
                fontFamily: 'var(--font-fiora-display), serif',
                color: ink,
                fontSize: 'clamp(2.8rem, 6vw, 4.6rem)',
                fontWeight: 300,
                letterSpacing: '-0.022em',
                lineHeight: 1.05,
              }}
            >
              {pickHeroTitle(store)}
            </h1>
            <p
              className="text-lg leading-[1.85] mb-10 max-w-md"
              style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
            >
              {pickHeroLede(store)}
            </p>
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-block px-9 py-3 border text-base font-normal transition-colors hover:bg-black hover:text-white"
                style={{ borderColor: ink, color: ink }}
              >
                Découvrir
              </Link>
            )}
          </div>
          <div className="md:col-span-6 grid grid-cols-5 gap-3 sm:gap-5">
            <div className="col-span-3 relative aspect-[3/4] overflow-hidden">
              {heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt={store.name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-5xl"
                  style={{ backgroundColor: theme.colors.surface, color: theme.colors.muted }}
                  aria-hidden
                >
                  {store.logoEmoji || 'F'}
                </div>
              )}
            </div>
            <div className="col-span-2 flex flex-col gap-3 sm:gap-5">
              <div className="relative aspect-square overflow-hidden">
                {heroSide ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroSide} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: theme.colors.surface }}
                    aria-hidden
                  />
                )}
              </div>
              <div
                className="relative aspect-square overflow-hidden flex items-end justify-start p-4"
                style={{ backgroundColor: theme.colors.inkDeep, color: '#FFFFFF' }}
              >
                <p
                  className="text-sm font-normal uppercase"
                  style={{ letterSpacing: '0.18em' }}
                >
                  {pickHeroBadge(store)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== SERVICES — "Find Your Perfect Match" =================== */}
      {services.length > 0 && (
        <section
          className="px-6 sm:px-12 py-24 border-y"
          style={{ borderColor: theme.colors.line, backgroundColor: theme.colors.surface }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="mb-14 max-w-2xl">
              <h2
                className="mb-4"
                style={{
                  fontFamily: 'var(--font-fiora-display), serif',
                  color: ink,
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
                  fontWeight: 300,
                  letterSpacing: '-0.022em',
                  lineHeight: 1.1,
                }}
              >
                {pickServicesHeadline(store)}
              </h2>
              <p
                className="text-lg font-normal leading-[1.85]"
                style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
              >
                {pickServicesLede(store)}
              </p>
            </div>
            <ul className="divide-y" style={{ borderColor: theme.colors.line }}>
              {services.map((s, idx) => (
                <li
                  key={idx}
                  className="grid grid-cols-12 gap-6 py-8 items-center"
                  style={{ borderColor: theme.colors.line }}
                >
                  <div className="col-span-3 sm:col-span-2">
                    <div
                      className="relative aspect-square overflow-hidden"
                      style={{ backgroundColor: theme.colors.bg }}
                    >
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image}
                          alt={s.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            fontFamily: 'var(--font-fiora-display), serif',
                            color: ink,
                            fontSize: '20px',
                            fontWeight: 400,
                          }}
                          aria-hidden
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-6 sm:col-span-7">
                    <h3
                      className="mb-2"
                      style={{
                        fontFamily: 'var(--font-fiora-display), serif',
                        color: bodyColor,
                        fontSize: '24px',
                        fontWeight: 300,
                      }}
                    >
                      {s.title}
                    </h3>
                    <p
                      className="text-base font-normal leading-[1.7]"
                      style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
                    >
                      {s.body}
                    </p>
                  </div>
                  <div className="col-span-3 text-right">
                    <Link
                      href={s.href}
                      className="inline-block px-5 py-2 border text-sm font-normal transition-colors hover:bg-black hover:text-white"
                      style={{ borderColor: ink, color: ink }}
                    >
                      Découvrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============== COLOR ROWS — numbered editorial 01 / 02 / 03 ============= */}
      {colorRows.length > 0 && (
        <section className="px-6 sm:px-12 py-24 max-w-6xl mx-auto">
          <div className="mb-14 max-w-2xl">
            <h2
              className="mb-4"
              style={{
                fontFamily: 'var(--font-fiora-display), serif',
                color: ink,
                fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
                fontWeight: 300,
                letterSpacing: '-0.022em',
                lineHeight: 1.1,
              }}
            >
              {pickPaletteHeadline(store)}
            </h2>
            <p
              className="text-lg leading-[1.85]"
              style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
            >
              {pickPaletteLede(store)}
            </p>
          </div>
          <ul className="divide-y" style={{ borderColor: theme.colors.line }}>
            {colorRows.map((row, idx) => (
              <li
                key={idx}
                className="grid grid-cols-12 gap-6 py-8 items-center"
                style={{ borderColor: theme.colors.line }}
              >
                <div className="col-span-2 sm:col-span-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-fiora-display), serif',
                      color: ink,
                      fontSize: 'clamp(1.6rem, 2.4vw, 2rem)',
                      fontWeight: 300,
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <div
                    className="relative aspect-[3/4] overflow-hidden"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
                    {row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.image}
                        alt={row.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: row.swatch || theme.colors.surface }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
                <div className="col-span-7 sm:col-span-9">
                  <h3
                    className="mb-2"
                    style={{
                      fontFamily: 'var(--font-fiora-display), serif',
                      color: ink,
                      fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)',
                      fontWeight: 400,
                    }}
                  >
                    {row.title}
                  </h3>
                  <p
                    className="text-base font-normal leading-[1.7] max-w-xl"
                    style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
                  >
                    {row.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============== GALLERY — "A Glimpse of the Glow-Up" =================== */}
      {galleryProducts.length > 0 && (
        <section
          className="px-6 sm:px-12 py-24 border-y"
          style={{ borderColor: theme.colors.line, backgroundColor: theme.colors.surface }}
        >
          <div className="max-w-6xl mx-auto text-center mb-14">
            <h2
              className="mb-4"
              style={{
                fontFamily: 'var(--font-fiora-display), serif',
                color: ink,
                fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
                fontWeight: 300,
                letterSpacing: '-0.022em',
              }}
            >
              {pickGalleryHeadline(store)}
            </h2>
            <p
              className="text-lg font-normal leading-[1.85] max-w-xl mx-auto"
              style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
            >
              {pickGalleryLede(store)}
            </p>
          </div>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4">
            <Link
              href={`/shop/${store.slug}/products/${galleryProducts[0].handle}`}
              className="md:col-span-7 relative aspect-[4/5] md:aspect-auto overflow-hidden"
              style={{ backgroundColor: theme.colors.bg }}
            >
              {galleryProducts[0].thumbnail || galleryProducts[0].images?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={galleryProducts[0].thumbnail || galleryProducts[0].images?.[0]?.url || ''}
                  alt={galleryProducts[0].title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{ color: theme.colors.muted }}
                  aria-hidden
                >
                  {store.logoEmoji || 'F'}
                </div>
              )}
            </Link>
            <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
              {galleryProducts.slice(1, 4).map((p) => {
                const image = p.thumbnail || p.images?.[0]?.url;
                return (
                  <Link
                    key={p.id}
                    href={`/shop/${store.slug}/products/${p.handle}`}
                    className="relative aspect-[4/3] overflow-hidden"
                    style={{ backgroundColor: theme.colors.bg }}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-3xl"
                        style={{ color: theme.colors.muted }}
                        aria-hidden
                      >
                        {store.logoEmoji || 'F'}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="text-center mt-12">
            <Link
              href={`/shop/${store.slug}`}
              className="inline-block px-9 py-3 border text-base font-normal transition-colors hover:bg-black hover:text-white"
              style={{ borderColor: ink, color: ink }}
            >
              Voir la galerie complète
            </Link>
          </div>
        </section>
      )}

      {/* ============== TESTIMONIALS — 3 column quotes ========================= */}
      <section className="px-6 sm:px-12 py-24 max-w-6xl mx-auto">
        <h2
          className="mb-14 max-w-xl"
          style={{
            fontFamily: 'var(--font-fiora-display), serif',
            color: ink,
            fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
            fontWeight: 300,
            letterSpacing: '-0.022em',
            lineHeight: 1.1,
          }}
        >
          {pickTestimonialHeadline(store)}
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {buildTestimonials(store).map((t, i) => (
            <li key={i}>
              <p
                className="text-lg leading-[1.85] mb-6"
                style={{
                  color: bodyColor,
                  fontFamily: 'var(--font-fiora-body), serif',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>
              <p
                className="text-sm font-normal uppercase"
                style={{ color: bodyColor, letterSpacing: '0.22em' }}
              >
                {t.author}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ============== FINAL CTA — centred serif ============================ */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-12 py-24 text-center border-y"
          style={{ borderColor: theme.colors.line, backgroundColor: theme.colors.bg }}
        >
          <h2
            className="mb-6 max-w-2xl mx-auto"
            style={{
              fontFamily: 'var(--font-fiora-display), serif',
              color: ink,
              fontSize: 'clamp(2.2rem, 4.8vw, 3.6rem)',
              fontWeight: 300,
              letterSpacing: '-0.022em',
              lineHeight: 1.1,
            }}
          >
            {pickFinalCtaHeadline(store)}
          </h2>
          <p
            className="text-lg font-normal leading-[1.85] mb-10 max-w-md mx-auto"
            style={{ color: bodyColor, fontFamily: 'var(--font-fiora-body), serif' }}
          >
            {pickFinalCtaLede(store)}
          </p>
          <div className="max-w-xs mx-auto">
            <AddToCartButton
              variantId={products[0].variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== FOOTER — four columns serif =========================== */}
      <footer
        className="px-6 sm:px-12 py-20"
        style={{ backgroundColor: theme.colors.bg, color: bodyColor }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <p
              style={{
                fontFamily: 'var(--font-fiora-display), serif',
                color: ink,
                fontSize: '28px',
                fontWeight: 300,
                letterSpacing: '-0.02em',
                marginBottom: 16,
              }}
            >
              {store.name}
            </p>
            <p className="text-base font-normal leading-[1.75]" style={{ color: bodyColor }}>
              Une maison {store.niche || 'beauté'} pensée pour celles et ceux qui aiment les détails.
            </p>
          </div>
          <div>
            <p className="text-base font-normal leading-[1.85]" style={{ color: bodyColor }}>
              500 Terry Francine St
              <br />
              San Francisco, CA 94158
              <br />
              <br />
              +33 1 23 45 67 89
              <br />
              hello@{slugifyDomain(store.name)}
            </p>
          </div>
          <div>
            <p
              className="text-sm uppercase mb-3"
              style={{
                color: ink,
                letterSpacing: '0.18em',
                fontFamily: 'var(--font-fiora-body), serif',
              }}
            >
              Maison
            </p>
            <ul className="text-base leading-[1.85]" style={{ color: bodyColor }}>
              <li>Accueil</li>
              <li>À propos</li>
              <li>Galerie</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <p
              className="text-sm uppercase mb-3"
              style={{
                color: ink,
                letterSpacing: '0.18em',
                fontFamily: 'var(--font-fiora-body), serif',
              }}
            >
              Suivez-nous
            </p>
            <ul className="text-base leading-[1.85]" style={{ color: bodyColor }}>
              <li>Instagram</li>
              <li>Facebook</li>
              <li>Pinterest</li>
            </ul>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto mt-16 pt-8 border-t flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm font-normal"
          style={{ borderColor: theme.colors.line, color: bodyColor }}
        >
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span style={{ color: accent }}>
            {store.niche ? `Univers ${store.niche}` : 'Atelier de beauté'}
          </span>
        </div>
      </footer>
    </div>
  );
}

function pickHeroTitle(store: StoreConfig): string {
  const html = store.landingContent?.hero?.headline_html;
  if (html) return html.replace(/<[^>]+>/g, '').trim();
  return store.tagline || `L’art de ${store.niche || 'la maison'}`;
}

function pickHeroLede(store: StoreConfig): string {
  return (
    store.landingContent?.hero?.lede ||
    store.description ||
    `Une sélection ${store.niche || 'soigneuse'} signée ${store.name}, pensée pour révéler chaque détail.`
  );
}

function pickHeroBadge(store: StoreConfig): string {
  const points = store.landingContent?.selling_points;
  if (Array.isArray(points) && points[0]?.title) {
    return points[0].title.toUpperCase();
  }
  return 'Sur rendez-vous';
}

interface Service {
  title: string;
  body: string;
  image: string | null | undefined;
  href: string;
}

function buildServices(store: StoreConfig, products: FioraLocksProduct[]): Service[] {
  const points = store.landingContent?.selling_points;
  const fallbackImages = products.slice(0, 4).map((p) => p.thumbnail || p.images?.[0]?.url);
  if (Array.isArray(points) && points.length >= 3) {
    return points.slice(0, 4).map((p, i) => ({
      title: p.title || `Service ${i + 1}`,
      body: p.body || '',
      image: store.lifestyleImages[i] || fallbackImages[i] || null,
      href: products[i]
        ? `/shop/${store.slug}/products/${products[i].handle}`
        : `/shop/${store.slug}`,
    }));
  }
  // Generic 4-row fallback
  const generic = [
    {
      title: 'Sélection signature',
      body: store.description
        ? truncate(store.description, 120)
        : `Notre univers ${store.niche || 'maison'} pensé pièce par pièce.`,
    },
    {
      title: 'Conseil personnalisé',
      body: `Une approche sur-mesure pour révéler ce qui vous va vraiment.`,
    },
    {
      title: 'Matières d’exception',
      body: `Des matériaux choisis avec soin, du premier essai au choix final.`,
    },
    {
      title: 'Sur rendez-vous',
      body: `Prenez le temps de découvrir ${store.name} dans un cadre confidentiel.`,
    },
  ];
  return generic.map((g, i) => ({
    ...g,
    image: store.lifestyleImages[i] || fallbackImages[i] || null,
    href: products[i]
      ? `/shop/${store.slug}/products/${products[i].handle}`
      : `/shop/${store.slug}`,
  }));
}

interface ColorRow {
  title: string;
  body: string;
  image?: string | null | undefined;
  swatch?: string;
}

function buildColorRows(store: StoreConfig, products: FioraLocksProduct[]): ColorRow[] {
  const list = store.landingContent?.included_items;
  const fallbackImages = products.slice(0, 5).map((p) => p.thumbnail || p.images?.[0]?.url);
  if (Array.isArray(list) && list.length >= 3) {
    return list.slice(0, 5).map((it, i) => ({
      title: it.label || `Pièce ${i + 1}`,
      body: it.qty || '',
      image: fallbackImages[i] || null,
    }));
  }
  // Fallback — list up to 5 products with their first description sentence.
  return products.slice(0, 5).map((p, i) => ({
    title: p.title,
    body: firstSentence(p.description) ||
      `Une pièce signée ${store.name}, à intégrer à votre quotidien.`,
    image: fallbackImages[i] || null,
  }));
}

function pickServicesHeadline(store: StoreConfig): string {
  return (
    store.landingContent?.showcase?.kicker ||
    `Trouvez votre signature ${store.niche || 'maison'}`
  );
}

function pickServicesLede(store: StoreConfig): string {
  return (
    store.landingContent?.showcase?.lede ||
    store.tagline ||
    `Une sélection éditoriale conçue pour révéler ce qui vous va le mieux.`
  );
}

function pickPaletteHeadline(_store: StoreConfig): string {
  return 'Notre vestiaire';
}

function pickPaletteLede(store: StoreConfig): string {
  return (
    store.description ||
    `Cinq pièces, cinq registres. Chaque entrée du vestiaire ${store.name} a son caractère.`
  );
}

function pickGalleryHeadline(_store: StoreConfig): string {
  return 'Aperçu de la maison';
}

function pickGalleryLede(store: StoreConfig): string {
  return (
    store.landingContent?.beach_moment?.headline_html?.replace(/<[^>]+>/g, '').trim() ||
    `Quelques instants choisis pour entrer dans l’univers ${store.name}.`
  );
}

function pickTestimonialHeadline(_store: StoreConfig): string {
  return 'Ce que nos clientes disent';
}

interface Testimonial {
  quote: string;
  author: string;
}

function buildTestimonials(store: StoreConfig): Testimonial[] {
  const lede = store.landingContent?.hero?.lede;
  const desc = store.description;
  const generic: Testimonial[] = [
    {
      quote:
        lede ||
        `L’accueil et l’attention chez ${store.name} font toute la différence. On en ressort avec le sentiment d’avoir été vraiment écoutée.`,
      author: 'Alani M.',
    },
    {
      quote:
        desc
          ? truncate(desc, 180)
          : `Un rapport au détail rare. Chaque pièce a sa raison d’être et ça se sent dès le premier essayage.`,
      author: 'Kaia L.',
    },
    {
      quote:
        store.tagline ||
        `Une découverte. Je reviendrai pour toutes mes prochaines occasions, sans hésiter.`,
      author: 'Elise V.',
    },
  ];
  return generic;
}

function pickFinalCtaHeadline(store: StoreConfig): string {
  return (
    store.landingContent?.final_cta?.headline_html?.replace(/<[^>]+>/g, '').trim() ||
    `Prête à découvrir ${store.name} ?`
  );
}

function pickFinalCtaLede(store: StoreConfig): string {
  return (
    store.landingContent?.final_cta?.lede ||
    `Réservez votre moment chez nous, ou commencez par feuilleter le catalogue.`
  );
}

function slugifyDomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
}

function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dot = trimmed.indexOf('.');
  if (dot > 12 && dot < 220) return trimmed.slice(0, dot + 1);
  return trimmed.length <= 220 ? trimmed : trimmed.slice(0, 219) + '…';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
