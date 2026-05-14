import Link from 'next/link';
import { Montserrat, Inter } from 'next/font/google';
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

export interface AdventureTravel2787Product {
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
  products: AdventureTravel2787Product[];
}

/**
 * Adventure Travel 2787 Landing — port of the Wix "Mont Névé" adventure
 * tourism template (https://www.wix.com/templatesfr/2787-adventure-tou-1).
 *
 * Design grammar lifted from the source:
 *   - Cinematic snowy hero photograph with a centred bold white Montserrat
 *     headline at 65px ("Bienvenue au Mont Névé") and a white-outline pill
 *     CTA below ("Réserver").
 *   - A second hero overlay: an over-large lifestyle photo on the left and
 *     a black panel on the right ("Nos randonnées") with a stack of 4
 *     tour rows — each row carries a 22px Montserrat title, schedule
 *     placeholder text, price, and a bright red (#FF2929) "Réserver"
 *     button glued to the right edge.
 *   - "Profiter des joies de l'hiver" section with a 4-column icon row
 *     (Aventure / Sécurité / Souvenirs / Expériences) under a 55px serif
 *     headline.
 *   - "Être au sommet" — dark wide testimonial-style card overlapping a
 *     group portrait on the right.
 *   - "Actus Névé" — 3-column blog-style article cards on a dark band.
 *   - Dark navy footer with a red square logo mark + 3 columns of links.
 */

const display = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-adv2787-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-adv2787-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F4F4F4',
    ink: '#1C1C1C', // headline ink + dark band
    dark: '#0F1216', // overlay panel + footer
    body: '#3A3A3A',
    muted: '#7B7B7B',
    accent: '#FF2929', // red CTA buttons
    line: '#E5E5E5',
  },
} as const;

export function AdventureTravel2787Landing({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const ink = theme.colors.ink;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const tourImage =
    store.lifestyleImages[0] ||
    products[1]?.thumbnail ||
    products[1]?.images?.[0]?.url ||
    heroImage;

  const tours = products.slice(0, 4);
  const journalImage1 =
    store.lifestyleImages[1] || products[2]?.thumbnail || products[2]?.images?.[0]?.url;
  const summitImage =
    store.lifestyleImages[2] || products[3]?.thumbnail || products[3]?.images?.[0]?.url || heroImage;

  return (
    <div
      className={`${display.variable} ${body.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: theme.colors.body,
        fontFamily: 'var(--font-adv2787-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — slim white bar with brand stack ============== */}
      <header className="px-5 sm:px-10 py-5 border-b" style={{ borderColor: theme.colors.line }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="flex flex-col gap-0.5"
          >
            <span
              className="font-bold uppercase tracking-tight"
              style={{
                fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                color: ink,
                fontSize: '17px',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {store.name}
            </span>
            <span
              className="text-xs font-light"
              style={{ color: theme.colors.muted, letterSpacing: '0.04em' }}
            >
              {pickNavTagline(store)}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-light">
            <span style={{ color: ink }}>Accueil</span>
            <span style={{ color: theme.colors.body }}>Aventures</span>
            <span style={{ color: theme.colors.body }}>Guides</span>
            <span style={{ color: theme.colors.body }}>Contact</span>
          </nav>
          <Link
            href={`/shop/${store.slug}`}
            className="hidden sm:inline-block px-5 py-2 text-sm font-medium uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: '#FFFFFF', letterSpacing: '0.04em' }}
          >
            Réserver
          </Link>
        </div>
      </header>

      {/* ============== HERO — full-bleed photo with centred big bold headline ====== */}
      <section className="relative w-full overflow-hidden">
        <div className="relative" style={{ minHeight: 'clamp(560px, 80vh, 720px)' }}>
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
              style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
              aria-hidden
            >
              {store.logoEmoji || '⛰'}
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(15,18,22,0.05) 0%, rgba(15,18,22,0.5) 70%, rgba(15,18,22,0.7) 100%)',
            }}
            aria-hidden
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-16">
            <h1
              className="font-bold mb-7 max-w-4xl"
              style={{
                fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                color: '#FFFFFF',
                fontSize: 'clamp(2.4rem, 6vw, 4.4rem)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.005em',
              }}
            >
              {pickHeroTitle(store)}
            </h1>
            <p
              className="text-base sm:text-lg font-light leading-[1.75] mb-9 max-w-xl"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              {pickHeroLede(store)}
            </p>
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-block px-10 py-3.5 text-sm font-medium uppercase border-2 transition-colors hover:bg-white hover:text-black"
                style={{
                  borderColor: '#FFFFFF',
                  color: '#FFFFFF',
                  backgroundColor: 'transparent',
                  letterSpacing: '0.18em',
                }}
              >
                Réserver
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============== TOURS BLOCK — image + dark overlay with stack of trips ========== */}
      {tours.length > 0 && (
        <section className="relative px-5 sm:px-10 -mt-16 sm:-mt-24 z-10 mb-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-4 items-stretch">
            <div
              className="md:col-span-5 relative aspect-[4/3] md:aspect-auto md:min-h-[520px] overflow-hidden"
              style={{ backgroundColor: theme.colors.surface }}
            >
              {tourImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tourImage}
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
                  {store.logoEmoji || '⛰'}
                </div>
              )}
            </div>
            <div
              className="md:col-span-7 px-6 sm:px-10 py-10 sm:py-14"
              style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
            >
              <h2
                className="font-bold mb-8"
                style={{
                  fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                  color: '#FFFFFF',
                  fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)',
                  fontWeight: 400,
                  lineHeight: 1.1,
                }}
              >
                {pickToursHeadline(store)}
              </h2>
              <ul
                className="divide-y"
                style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
              >
                {tours.map((tour) => {
                  const variant = tour.variants?.[0];
                  const price = variant?.calculated_price?.calculated_amount;
                  const currency = variant?.calculated_price?.currency_code || 'eur';
                  const formattedPrice =
                    price !== undefined ? formatMoney(price, currency) : null;
                  return (
                    <li
                      key={tour.id}
                      className="grid grid-cols-12 gap-3 sm:gap-4 py-5 items-center"
                      style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                    >
                      <div className="col-span-7">
                        <h3
                          className="mb-1"
                          style={{
                            fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                            color: '#FFFFFF',
                            fontSize: '20px',
                            fontWeight: 500,
                          }}
                        >
                          {tour.title}
                        </h3>
                        <p
                          className="text-sm font-light"
                          style={{ color: 'rgba(255, 255, 255, 0.65)' }}
                        >
                          {firstSentence(tour.description) || 'Disponibilités à venir'}
                        </p>
                      </div>
                      <div className="col-span-2 text-right tabular-nums">
                        {formattedPrice && (
                          <span
                            className="text-base font-light"
                            style={{ color: '#FFFFFF' }}
                          >
                            {formattedPrice}
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 text-right">
                        <Link
                          href={`/shop/${store.slug}/products/${tour.handle}`}
                          className="inline-block w-full sm:w-auto px-4 py-2.5 text-xs font-medium uppercase transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: accent,
                            color: '#FFFFFF',
                            letterSpacing: '0.16em',
                          }}
                        >
                          Réserver
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ============== JOYS / FEATURE STRIP — 4 icons + section title ===== */}
      <section className="px-6 sm:px-10 py-24 max-w-6xl mx-auto text-center">
        <h2
          className="font-bold mb-5"
          style={{
            fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
            color: ink,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {pickJoysHeadline(store)}
        </h2>
        <p
          className="text-base font-light leading-[1.85] mb-14 max-w-2xl mx-auto"
          style={{ color: theme.colors.body }}
        >
          {pickJoysLede(store)}
        </p>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {buildJoys(store).map((joy, i) => (
            <li key={i} className="flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                style={{
                  backgroundColor: theme.colors.surface,
                  color: accent,
                  fontSize: '22px',
                }}
                aria-hidden
              >
                {joy.icon}
              </div>
              <h3
                className="mb-2"
                style={{
                  fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                  color: ink,
                  fontSize: '20px',
                  fontWeight: 500,
                }}
              >
                {joy.title}
              </h3>
              <p
                className="text-sm font-light leading-[1.7] max-w-[220px]"
                style={{ color: theme.colors.body }}
              >
                {joy.body}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-14">
          <Link
            href={`/shop/${store.slug}`}
            className="inline-block px-9 py-3 text-sm font-medium uppercase border-2 transition-colors hover:bg-black hover:text-white"
            style={{ borderColor: ink, color: ink, letterSpacing: '0.16em' }}
          >
            En savoir plus
          </Link>
        </div>
      </section>

      {/* ============== SUMMIT BAND — overlap dark card + portrait ============= */}
      <section className="relative px-5 sm:px-10 py-16 sm:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          <div
            className="md:col-span-5 px-7 sm:px-10 py-12 flex flex-col justify-center"
            style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
          >
            <h2
              className="font-bold mb-6"
              style={{
                fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                color: '#FFFFFF',
                fontSize: 'clamp(1.8rem, 3.6vw, 2.8rem)',
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {pickSummitHeadline(store)}
            </h2>
            <p
              className="text-base font-light leading-[1.85] mb-7"
              style={{ color: 'rgba(255, 255, 255, 0.78)' }}
            >
              {pickSummitLede(store)}
            </p>
            <p
              className="text-sm font-medium uppercase"
              style={{ color: accent, letterSpacing: '0.18em' }}
            >
              {pickSummitAuthor(store)}
            </p>
          </div>
          <div
            className="md:col-span-7 relative aspect-[4/3] md:aspect-auto md:min-h-[420px] overflow-hidden"
            style={{ backgroundColor: theme.colors.surface }}
          >
            {summitImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={summitImage}
                alt={store.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-6xl"
                style={{ color: theme.colors.muted }}
                aria-hidden
              >
                {store.logoEmoji || '⛰'}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============== JOURNAL — "Actus Névé" 3-card grid ================== */}
      <section
        className="px-6 sm:px-10 py-24"
        style={{ backgroundColor: theme.colors.bg }}
      >
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-center font-bold mb-14"
            style={{
              fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
              color: ink,
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 700,
            }}
          >
            {pickJournalHeadline(store)}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {buildJournal(store, products, journalImage1).map((card, idx) => (
              <li key={idx}>
                <article
                  className="relative aspect-[4/5] overflow-hidden text-white"
                  style={{ backgroundColor: theme.colors.dark }}
                >
                  {card.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.image}
                        alt={card.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(15,18,22,0) 30%, rgba(15,18,22,0.78) 100%)',
                        }}
                        aria-hidden
                      />
                    </>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 px-5 py-5">
                    <p
                      className="text-xs font-light uppercase mb-2"
                      style={{ color: accent, letterSpacing: '0.18em' }}
                    >
                      {card.kicker}
                    </p>
                    <h3
                      style={{
                        fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                        color: '#FFFFFF',
                        fontSize: '18px',
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      {card.title}
                    </h3>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <div className="mt-14 text-center">
            <Link
              href={`/shop/${store.slug}`}
              className="inline-block px-9 py-3 text-sm font-medium uppercase border-2 transition-colors hover:bg-black hover:text-white"
              style={{ borderColor: ink, color: ink, letterSpacing: '0.16em' }}
            >
              Lire plus
            </Link>
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA — fast-add ======================== */}
      {products[0]?.variants?.[0] && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-xs font-medium uppercase mb-4"
            style={{ color: accent, letterSpacing: '0.32em' }}
          >
            Réservez votre saison
          </p>
          <h2
            className="font-bold mb-10 max-w-2xl mx-auto"
            style={{
              fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
              color: ink,
              fontSize: 'clamp(2rem, 4.4vw, 3rem)',
              fontWeight: 700,
              lineHeight: 1.15,
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

      {/* ============== FOOTER — dark navy + red accent mark =============== */}
      <footer
        className="px-6 sm:px-10 pt-16 pb-10"
        style={{ backgroundColor: theme.colors.dark, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="flex flex-col items-start gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center font-bold"
              style={{ backgroundColor: accent, color: '#FFFFFF', fontSize: 18 }}
              aria-hidden
            >
              {store.logoEmoji || store.name.charAt(0).toUpperCase()}
            </div>
            <p
              style={{
                fontFamily: 'var(--font-adv2787-display), Montserrat, sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {store.name}
            </p>
            <p
              className="text-sm font-light leading-[1.75]"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              {pickFooterTagline(store)}
            </p>
          </div>
          <div>
            <p
              className="text-xs font-medium uppercase mb-3"
              style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.22em' }}
            >
              Explorer
            </p>
            <ul className="text-sm leading-[1.95] font-light" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              <li>Aventures</li>
              <li>Guides</li>
              <li>Réservation</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <p
              className="text-xs font-medium uppercase mb-3"
              style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.22em' }}
            >
              Contact
            </p>
            <p className="text-sm font-light leading-[1.85]" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              hello@{slugifyDomain(store.name)}
              <br />
              +33 1 23 45 67 89
            </p>
          </div>
          <div>
            <p
              className="text-xs font-medium uppercase mb-3"
              style={{ color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.22em' }}
            >
              Suivez
            </p>
            <ul className="text-sm leading-[1.85] font-light" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              <li>Instagram</li>
              <li>Youtube</li>
              <li>Strava</li>
            </ul>
          </div>
        </div>

        <div
          className="max-w-6xl mx-auto mt-14 pt-8 border-t flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs font-light"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.14em',
          }}
        >
          <span className="uppercase">© {new Date().getFullYear()} {store.name}</span>
          <span className="uppercase">
            {store.niche ? store.niche : 'Aventure'}
          </span>
        </div>
      </footer>
    </div>
  );
}

function pickNavTagline(store: StoreConfig): string {
  return store.tagline?.length
    ? truncate(store.tagline, 36)
    : store.niche
      ? `${store.niche.charAt(0).toUpperCase()}${store.niche.slice(1)} & aventure`
      : 'Aventures à la carte';
}

function pickHeroTitle(store: StoreConfig): string {
  const html = store.landingContent?.hero?.headline_html;
  if (html) return html.replace(/<[^>]+>/g, '').trim();
  return `Bienvenue chez ${store.name}`;
}

function pickHeroLede(store: StoreConfig): string {
  return (
    store.landingContent?.hero?.lede ||
    store.tagline ||
    store.description ||
    `Vivez l’aventure ${store.niche || 'plein air'} avec ${store.name}.`
  );
}

function pickToursHeadline(_store: StoreConfig): string {
  return 'Nos aventures';
}

interface Joy {
  title: string;
  body: string;
  icon: string;
}

function buildJoys(store: StoreConfig): Joy[] {
  const points = store.landingContent?.selling_points;
  const icons = ['▲', '◆', '◯', '✦'];
  if (Array.isArray(points) && points.length >= 4) {
    return points.slice(0, 4).map((p, i) => ({
      title: p.title || `Atout ${i + 1}`,
      body: p.body || '',
      icon: icons[i],
    }));
  }
  return [
    { title: 'Aventure', body: 'Des parcours pensés pour les amoureux du grand air.', icon: icons[0] },
    {
      title: 'Sécurité',
      body: 'Des guides certifiés à chaque étape, du briefing au retour.',
      icon: icons[1],
    },
    { title: 'Souvenirs', body: 'Des moments à raconter pendant des années.', icon: icons[2] },
    {
      title: 'Expériences',
      body: `Une autre façon de découvrir ${store.niche || 'la montagne'} avec ${store.name}.`,
      icon: icons[3],
    },
  ];
}

function pickJoysHeadline(_store: StoreConfig): string {
  return 'Profiter pleinement de la saison';
}

function pickJoysLede(store: StoreConfig): string {
  return (
    store.landingContent?.showcase?.lede ||
    store.tagline ||
    `${store.name} vous accompagne sur chaque sortie, débutant ou aguerri.`
  );
}

function pickSummitHeadline(_store: StoreConfig): string {
  return 'Être au sommet';
}

function pickSummitLede(store: StoreConfig): string {
  return (
    store.description ||
    store.landingContent?.hero?.lede ||
    `Nos clients témoignent : ${store.name} sait transformer une journée en souvenir.`
  );
}

function pickSummitAuthor(_store: StoreConfig): string {
  return 'Justin, guide officiel';
}

function pickJournalHeadline(store: StoreConfig): string {
  return `Actus ${storeShortName(store)}`;
}

interface JournalCard {
  kicker: string;
  title: string;
  image: string | null | undefined;
}

function buildJournal(
  store: StoreConfig,
  products: AdventureTravel2787Product[],
  primary: string | undefined,
): JournalCard[] {
  const items = store.landingContent?.specs;
  const fallbackImages = [
    primary,
    store.lifestyleImages[3] || products[2]?.thumbnail || products[2]?.images?.[0]?.url,
    store.lifestyleImages[4] || products[3]?.thumbnail || products[3]?.images?.[0]?.url,
  ];
  if (Array.isArray(items) && items.length >= 3) {
    return items.slice(0, 3).map((it, i) => ({
      kicker: it.key || `Article ${i + 1}`,
      title: it.value || '',
      image: fallbackImages[i],
    }));
  }
  return [
    {
      kicker: 'Guide',
      title: `Comment découvrir ${store.niche || 'nos aventures'} en hiver`,
      image: fallbackImages[0],
    },
    {
      kicker: 'Météo',
      title: 'Bulletin météo et neige : décembre',
      image: fallbackImages[1],
    },
    {
      kicker: 'Conseil',
      title: 'Meilleurs conseils d’orientation en altitude',
      image: fallbackImages[2],
    },
  ];
}

function pickFooterTagline(store: StoreConfig): string {
  if (store.description) return truncate(store.description, 110);
  if (store.tagline) return store.tagline;
  return `Aventures ${store.niche || 'plein air'} signées ${store.name}.`;
}

function slugifyDomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
}

function storeShortName(store: StoreConfig): string {
  const first = store.name.split(/\s+/)[0];
  return first || store.name;
}

function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dot = trimmed.indexOf('.');
  if (dot > 12 && dot < 160) return trimmed.slice(0, dot + 1);
  return trimmed.length <= 110 ? trimmed : trimmed.slice(0, 108) + '…';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
