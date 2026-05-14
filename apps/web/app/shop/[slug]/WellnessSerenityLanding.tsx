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

export interface WellnessSerenityProduct {
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
  products: WellnessSerenityProduct[];
}

/**
 * Wellness Serenity Landing — port of the Wix "Spa Serenity" template
 * (https://fr.wix.com/website-template/view/html/2975, health-wellness
 * category).
 *
 * Design grammar lifted from the source:
 *   - Calm spa aesthetic. The hero pairs an uppercase Cormorant Garamond
 *     headline ("BIENVENUE CHEZ SÉRÉNITÉ") with a soft full-bleed photo
 *     of water / treatment, on a beige off-white background.
 *   - Five repeating story blocks ("BULLE BIEN-ÊTRE", "ENVIRONNEMENT
 *     RELAXANT", "LA SÉRÉNITÉ CHEZ VOUS", "HORAIRES", "NOTRE ADRESSE")
 *     — each is a centred serif title above a tight body paragraph and
 *     a small circular pill CTA, sometimes paired with a photo card on
 *     one side.
 *   - The palette is teal-on-cream: deep teal `#2D5661` for ink, warm
 *     sand `#F4F0E8` for surfaces, pale aqua `#D6E3DF` for accents.
 *   - The footer is a thin centred bar with three short address /
 *     hours / social columns and a single horizontal divider line.
 *
 * Every section is wired to `store.*` data: the H2 titles become
 * editorial labels for each storyline ("La maison" / "L'expérience" /
 * "Le rituel" / "Horaires" / "Adresse"), and the body paragraphs lean
 * on `store.description`, `store.tagline`, and `landingContent` slots
 * when available, falling back to niche-generic copy otherwise.
 */

// next/font/google — Cormorant Garamond reproduces the spa template's
// classical serif voice. Inter for body so French diacritics render
// cleanly at small body sizes.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-serenity-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-serenity-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F4F0E8', // warm cream the hero photo blends into
    soft: '#EAE2D2', // beige accent stripe
    aqua: '#D6E3DF', // pale water-blue tint
    ink: '#2D5661', // deep teal-sage, every heading + CTA
    inkSoft: '#41707C', // softer teal for body text
    muted: '#7B8E91', // body grey
    line: '#D9D4C8', // hairlines
  },
  radius: { plate: 0, pill: 9999 },
} as const;

export function WellnessSerenityLanding({ store, products }: Props) {
  // Wix accent fallback is overridden when the store has a brand palette.
  const accent = store.accentColor || store.primaryColor || theme.colors.ink;
  const ink = theme.colors.ink;
  const inkSoft = theme.colors.inkSoft;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Three editorial story blocks. We use up to three landingContent
  // selling points and pad with niche-generic copy.
  const storyBlocks = buildStoryBlocks(store);

  // Hours plate + address plate live at the bottom of the page — copy
  // is templated because no booking pipeline is wired in.
  const lifestyle = store.lifestyleImages.slice(0, 4);

  const heroLines = buildHeroLines(store);

  return (
    <div
      className={`${cormorant.variable} ${inter.variable}`}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-serenity-body), Inter, sans-serif',
      }}
    >
      {/* ============== NAV — thin centred mark =========================== */}
      <header
        className="relative z-10 px-6 sm:px-10 py-6"
        style={{
          borderBottom: `1px solid ${theme.colors.line}`,
          backgroundColor: theme.colors.bg,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            style={{
              color: ink,
              fontFamily: 'var(--font-serenity-display), serif',
            }}
            className="text-xl tracking-[0.32em] uppercase"
          >
            {store.name}
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-[11px] uppercase tracking-[0.32em] font-light" style={{ color: inkSoft }}>
            <span style={{ color: ink }}>Accueil</span>
            <span>L&apos;univers</span>
            <span>Boutique</span>
            <span>Contact</span>
          </nav>
          <span
            className="hidden sm:inline text-[11px] uppercase tracking-[0.32em] font-light"
            style={{ color: inkSoft }}
          >
            Panier (0)
          </span>
        </div>
      </header>

      {/* ============== HERO — centred serif title + soft photo =========== */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-20 pb-12 text-center">
          {heroLines.map((line, i) => (
            <h1
              key={i}
              className="uppercase"
              style={{
                color: ink,
                fontFamily: 'var(--font-serenity-display), serif',
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                lineHeight: 1.05,
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              {line}
            </h1>
          ))}
          {store.tagline && (
            <p
              className="mt-6 max-w-xl mx-auto text-sm font-light leading-[1.85]"
              style={{ color: inkSoft }}
            >
              {store.tagline}
            </p>
          )}
        </div>

        {/* Full-bleed photo strip — softens into the cream surface below. */}
        <div
          className="relative w-full"
          style={{ height: 'clamp(320px, 52vh, 560px)' }}
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
                color: theme.colors.muted,
                backgroundColor: theme.colors.aqua,
              }}
              aria-hidden
            >
              {store.logoEmoji || '◇'}
            </div>
          )}
        </div>
      </section>

      {/* ============== STORY BLOCKS — three centred ====================== */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-3xl mx-auto space-y-24 text-center">
          {storyBlocks.slice(0, 3).map((block, i) => (
            <div key={i}>
              <p
                className="text-[10px] uppercase tracking-[0.45em] font-light mb-5"
                style={{ color: inkSoft }}
              >
                {block.kicker}
              </p>
              <h2
                className="uppercase mb-8"
                style={{
                  color: ink,
                  fontFamily: 'var(--font-serenity-display), serif',
                  fontSize: 'clamp(1.75rem, 3.5vw, 3rem)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}
              >
                {block.headline}
              </h2>
              <p
                className="text-sm sm:text-base font-light leading-[1.95] mx-auto max-w-xl"
                style={{ color: inkSoft }}
              >
                {block.body}
              </p>
              {/* Round pill CTA (Wix used a small circular badge above each
                  story block). We render it only for the first block so the
                  CTA hierarchy stays clear. */}
              {i === 0 && products[0] && (
                <Link
                  href={`/shop/${store.slug}/products/${products[0].handle}`}
                  className="inline-flex mt-10 px-9 py-4 text-[11px] uppercase tracking-[0.32em] font-light transition-opacity hover:opacity-80"
                  style={{
                    border: `1px solid ${ink}`,
                    color: ink,
                    backgroundColor: 'transparent',
                  }}
                >
                  Découvrir
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============== TWO-COLUMN PHOTO + COPY ============================ */}
      {(lifestyle[0] || heroImage) && (
        <section
          className="px-6 sm:px-10 py-24"
          style={{ backgroundColor: theme.colors.aqua }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="relative aspect-[4/5] overflow-hidden">
              {lifestyle[0] || heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lifestyle[0] || heroImage || ''}
                  alt={store.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{ color: theme.colors.muted, backgroundColor: theme.colors.surface }}
                  aria-hidden
                >
                  {store.logoEmoji || '◇'}
                </div>
              )}
            </div>
            <div className="text-left">
              <p
                className="text-[10px] uppercase tracking-[0.45em] font-light mb-5"
                style={{ color: inkSoft }}
              >
                {storyBlocks[3]?.kicker || 'Le rituel'}
              </p>
              <h2
                className="uppercase mb-6"
                style={{
                  color: ink,
                  fontFamily: 'var(--font-serenity-display), serif',
                  fontSize: 'clamp(1.75rem, 3.5vw, 3rem)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}
              >
                {storyBlocks[3]?.headline || 'La sérénité chez vous'}
              </h2>
              <p
                className="text-sm sm:text-base font-light leading-[1.95] mb-8"
                style={{ color: inkSoft }}
              >
                {storyBlocks[3]?.body ||
                  store.description ||
                  `Une approche douce et engagée du ${store.niche || 'bien-être'}, pensée pour s'inviter dans votre quotidien.`}
              </p>
              {products[0]?.variants?.[0] && (
                <div className="max-w-xs">
                  <AddToCartButton
                    variantId={products[0].variants[0].id}
                    storeSlug={store.slug}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============== PRODUCT GRID — soft cream ========================== */}
      {products.length > 0 && (
        <section
          className="px-6 sm:px-10 py-24"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <div className="max-w-6xl mx-auto">
            <p
              className="text-center text-[10px] uppercase tracking-[0.45em] font-light mb-4"
              style={{ color: inkSoft }}
            >
              La sélection
            </p>
            <h2
              className="text-center uppercase mb-14"
              style={{
                color: ink,
                fontFamily: 'var(--font-serenity-display), serif',
                fontSize: 'clamp(1.75rem, 3.5vw, 3rem)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              Notre boutique
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-7">
              {products.slice(0, 6).map((product) => {
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
                        style={{ backgroundColor: theme.colors.aqua }}
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
                        className="text-sm font-light text-center"
                        style={{
                          color: ink,
                          fontFamily: 'var(--font-serenity-display), serif',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {product.title.toUpperCase()}
                      </p>
                      {formattedPrice && (
                        <p
                          className="mt-1 text-[11px] font-light tabular-nums text-center"
                          style={{ color: inkSoft }}
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

      {/* ============== HOURS + ADDRESS PLATES — Wix had these at the end == */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 text-center">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.45em] font-light mb-5"
              style={{ color: inkSoft }}
            >
              Horaires
            </p>
            <h3
              className="uppercase mb-6"
              style={{
                color: ink,
                fontFamily: 'var(--font-serenity-display), serif',
                fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              Notre rythme
            </h3>
            <p className="text-sm font-light leading-[1.95]" style={{ color: inkSoft }}>
              Du lundi au vendredi <br />
              9h – 19h <br />
              <span style={{ color: theme.colors.muted }}>
                Samedi sur rendez-vous
              </span>
            </p>
          </div>
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.45em] font-light mb-5"
              style={{ color: inkSoft }}
            >
              Adresse
            </p>
            <h3
              className="uppercase mb-6"
              style={{
                color: ink,
                fontFamily: 'var(--font-serenity-display), serif',
                fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              Où nous trouver
            </h3>
            <p className="text-sm font-light leading-[1.95]" style={{ color: inkSoft }}>
              {store.name}
              <br />
              Boutique en ligne
              <br />
              <span style={{ color: theme.colors.muted }}>
                Livraison France métropolitaine
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ============== FOOTER — thin centred bar ========================== */}
      <footer
        className="px-6 sm:px-10 py-16"
        style={{
          backgroundColor: theme.colors.bg,
          color: inkSoft,
          borderTop: `1px solid ${theme.colors.line}`,
        }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <p
            className="text-base tracking-[0.42em] uppercase mb-8"
            style={{
              color: ink,
              fontFamily: 'var(--font-serenity-display), serif',
              fontWeight: 500,
            }}
          >
            {store.name}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[11px] uppercase tracking-[0.32em] font-light mb-8">
            <span>Boutique</span>
            <span>L&apos;univers</span>
            <span>Newsletter</span>
            <span>Contact</span>
          </div>
          <div
            className="mx-auto w-16 h-px mb-8"
            style={{ backgroundColor: theme.colors.line }}
            aria-hidden
          />
          <p
            className="text-[11px] font-light"
            style={{ color: theme.colors.muted }}
          >
            © {new Date().getFullYear()} {store.name}. Tous droits réservés. ·{' '}
            <span style={{ color: accent }}>{store.niche || 'Maison'}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Wix template stacks the welcome line across two centred serif rows
 * ("BIENVENUE" / "CHEZ SÉRÉNITÉ"). We do the same with the store name
 * or tagline, splitting on a logical boundary.
 */
function buildHeroLines(store: StoreConfig): string[] {
  const tagline = (store.tagline || '').trim();
  if (tagline && tagline.length <= 36) {
    const words = tagline.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const mid = Math.ceil(words.length / 2);
      return [
        words.slice(0, mid).join(' ').toUpperCase(),
        words.slice(mid).join(' ').toUpperCase(),
      ];
    }
    return [tagline.toUpperCase()];
  }
  const name = (store.name || 'La Maison').trim();
  if (name.length <= 24) {
    return ['BIENVENUE', `CHEZ ${name.toUpperCase()}`];
  }
  return [name.toUpperCase()];
}

interface StoryBlock {
  kicker: string;
  headline: string;
  body: string;
}

function buildStoryBlocks(store: StoreConfig): StoryBlock[] {
  const points = store.landingContent?.selling_points;
  const blocks: StoryBlock[] = [];

  if (Array.isArray(points)) {
    for (const p of points.slice(0, 4)) {
      blocks.push({
        kicker: '',
        headline: (p.title || '').trim(),
        body: (p.body || '').trim(),
      });
    }
  }

  const kickers = ['La maison', 'L’expérience', 'Le rituel', 'Le quotidien'];
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].kicker) blocks[i].kicker = kickers[i];
  }

  const niche = store.niche || 'bien-être';
  const niceName = store.name || 'La Maison';

  while (blocks.length < 4) {
    const i = blocks.length;
    blocks.push({
      kicker: kickers[i],
      headline:
        i === 0
          ? 'Bulle bien-être'
          : i === 1
            ? 'Environnement relaxant'
            : i === 2
              ? 'La sérénité chez vous'
              : 'Un rituel sur mesure',
      body:
        i === 0
          ? store.description ||
            `${niceName}, une parenthèse calme dédiée au ${niche}. Une sélection apaisée, choisie pour faire baisser la pression.`
          : i === 1
            ? store.tagline ||
              'Chaque pièce est pensée pour son geste, son matériau et la lumière qu’elle laisse passer. Rien de criard, rien de futile.'
            : i === 2
              ? `Glissez nos rituels ${niche} dans votre quotidien. Une routine claire, des gestes simples, le sentiment d’avoir pris soin de vous.`
              : `Une équipe à l’écoute pour vous accompagner. Conseils sur mesure et expéditions soignées partout en France.`,
    });
  }

  return blocks;
}
