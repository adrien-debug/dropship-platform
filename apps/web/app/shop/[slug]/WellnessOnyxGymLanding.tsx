import Link from 'next/link';
import { Manrope } from 'next/font/google';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import type { StoreConfig } from '@/lib/store-config';

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: { calculated_amount: number; original_amount?: number; currency_code: string } | null;
}

export interface WellnessOnyxGymProduct {
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
  products: WellnessOnyxGymProduct[];
}

/**
 * Wellness Onyx Gym Landing — port of the Wix "salle de gym / Onyx
 * Fitness Facility" template (https://fr.wix.com/website-template/view/html/2726,
 * health and wellness category, gym / athletic archetype).
 *
 * Design grammar lifted from the source preview:
 *   - Athletic, high-energy. Hero is a full-bleed dark photograph with
 *     "Welcome to ONYX" centred in heavy white sans serif; a magenta
 *     "Join Now" pill anchors the bottom right.
 *   - Three feature blocks stack vertically with alternating cyan / dark
 *     / magenta backgrounds: "The Onyx Experience" / "Fitness Is for
 *     Everyone" / "Top Notch Facilities". Each pairs an athletic photo
 *     with bold heavy serif/sans titling and a thin pill CTA.
 *   - Photo strip across the bottom of the page — four facility tiles
 *     repeating in a horizontal scroll on mobile, grid on desktop.
 *   - Free-trial signup form in the footer (name + email) — we ship a
 *     simpler newsletter-style version honouring the existing dropship
 *     pipeline.
 *
 * Palette: deep onyx black `#121214`, accent magenta `#E03A8C`, accent
 * cyan `#2EC5D0`, off-white `#F5F5F2`. Every label is driven from
 * `store.*` props and is overridden by `store.primaryColor` etc.
 */

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-onyx',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#F5F5F2',
    onyx: '#121214', // deep near-black used in hero overlays + footer
    onyxSoft: '#1F1F22',
    ink: '#111111',
    inkSoft: '#3A3A3D',
    muted: '#727275',
    accent: '#E03A8C', // signature magenta CTA
    accentDeep: '#B72A6E',
    cyan: '#2EC5D0', // cyan tile used on the "Fitness is for everyone" block
    line: '#E2E2DC',
  },
  radius: { pill: 9999, tile: 4 },
} as const;

export function WellnessOnyxGymLanding({ store, products }: Props) {
  const accent =
    store.accentColor || store.primaryColor || theme.colors.accent;
  const cyan = store.secondaryColor || theme.colors.cyan;
  const ink = theme.colors.ink;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  // Wordmark — heavy uppercase letterforms with wide tracking, like
  // "ONYX". We render the store name in heavy weight; the navigation logo
  // sits left and uses tracking 0.32em to evoke the same energy.
  const wordmark = (store.name || 'Maison').trim();

  // Three feature blocks. Wix uses three; we map to landingContent
  // selling_points (if 3+ exist) otherwise we synthesise from the store
  // metadata.
  const blocks = buildBlocks(store, products);

  // Photo strip — four facility tiles. We tap into lifestyleImages then
  // overflow into the product gallery.
  const strip = buildStrip(store, products);

  const fastAdd = products[0];
  const fastAddVariant = fastAdd?.variants?.[0];

  return (
    <div
      className={manrope.variable}
      style={{
        backgroundColor: theme.colors.bg,
        color: ink,
        fontFamily: 'var(--font-onyx), Manrope, sans-serif',
      }}
    >
      {/* ============== NAV — dark bar over hero ====================== */}
      <header
        className="relative z-20 px-6 sm:px-10 py-5"
        style={{
          backgroundColor: theme.colors.onyx,
          color: '#FFFFFF',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <Link
            href={`/shop/${store.slug}`}
            className="flex items-center gap-2 text-base font-extrabold tracking-[0.32em] uppercase"
            style={{ color: '#FFFFFF' }}
          >
            <span aria-hidden style={{ color: accent }}>◆</span>
            <span>{wordmark}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-8 text-[12px] uppercase tracking-[0.28em] font-medium">
            <span style={{ color: '#FFFFFF' }}>Accueil</span>
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>L&apos;univers</span>
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>Boutique</span>
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>Contact</span>
          </nav>
          {products[0] && (
            <Link
              href={`/shop/${store.slug}/products/${products[0].handle}`}
              className="inline-block px-5 py-2.5 text-[12px] uppercase tracking-[0.28em] font-bold"
              style={{
                backgroundColor: accent,
                color: '#FFFFFF',
                borderRadius: theme.radius.pill,
              }}
            >
              Rejoindre
            </Link>
          )}
        </div>
      </header>

      {/* ============== HERO — full-bleed dark photo + heavy wordmark ===*/}
      <section
        className="relative w-full overflow-hidden"
        style={{
          minHeight: '74svh',
          backgroundColor: theme.colors.onyx,
        }}
      >
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={store.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'saturate(1.05) brightness(0.78)' }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${cyan} 0%, transparent 60%), radial-gradient(circle at 80% 70%, ${accent} 0%, transparent 55%), ${theme.colors.onyx}`,
            }}
            aria-hidden
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,18,20,0.45) 0%, rgba(18,18,20,0.55) 60%, rgba(18,18,20,0.78) 100%)',
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-32 min-h-[74svh] flex flex-col justify-center">
          <p
            className="text-[12px] uppercase tracking-[0.42em] font-bold mb-4"
            style={{ color: cyan }}
          >
            {store.landingContent?.hero?.kicker || 'La salle ouverte à tous'}
          </p>
          <h1
            className="font-extrabold uppercase leading-[0.95] tracking-[0.04em]"
            style={{
              color: '#FFFFFF',
              fontSize: 'clamp(3rem, 9vw, 7.5rem)',
            }}
          >
            <span className="block opacity-85" style={{ fontWeight: 500 }}>
              Bienvenue chez
            </span>
            <span className="block" style={{ color: '#FFFFFF' }}>
              {wordmark}
            </span>
          </h1>
          <p
            className="mt-7 max-w-xl text-base sm:text-lg font-light leading-[1.6]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {store.tagline ||
              store.landingContent?.hero?.lede ||
              `${store.name} · ${store.niche || 'lifestyle'} sans compromis.`}
          </p>
          <div className="mt-10 flex flex-wrap gap-3 items-center">
            {products[0] && (
              <Link
                href={`/shop/${store.slug}/products/${products[0].handle}`}
                className="inline-block px-7 py-3.5 text-[12px] uppercase tracking-[0.32em] font-bold transition-transform hover:scale-[1.02]"
                style={{
                  backgroundColor: accent,
                  color: '#FFFFFF',
                  borderRadius: theme.radius.pill,
                }}
              >
                Rejoindre maintenant
              </Link>
            )}
            <Link
              href={`/shop/${store.slug}`}
              className="inline-block px-7 py-3.5 text-[12px] uppercase tracking-[0.32em] font-bold border"
              style={{
                color: '#FFFFFF',
                borderColor: 'rgba(255,255,255,0.6)',
                borderRadius: theme.radius.pill,
              }}
            >
              Voir la boutique
            </Link>
          </div>
        </div>
      </section>

      {/* ============== FEATURE BLOCKS — alternating cyan / onyx / mag ==*/}
      {blocks.map((block, idx) => (
        <section
          key={idx}
          className="px-6 sm:px-10 py-20"
          style={{ backgroundColor: block.bg, color: block.fg }}
        >
          <div
            className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center ${
              idx % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
            }`}
          >
            <div>
              <p
                className="text-[12px] uppercase tracking-[0.42em] font-bold mb-3"
                style={{ color: block.kickerColor }}
              >
                {block.kicker}
              </p>
              <h2
                className="font-extrabold uppercase leading-[1.02] tracking-[0.02em]"
                style={{
                  color: block.fg,
                  fontSize: 'clamp(2.25rem, 5vw, 4rem)',
                }}
              >
                {block.headline}
              </h2>
              <p
                className="mt-6 text-base sm:text-lg font-light leading-[1.7] max-w-md"
                style={{ color: block.bodyColor }}
              >
                {block.body}
              </p>
              {block.linkHandle && (
                <Link
                  href={`/shop/${store.slug}/products/${block.linkHandle}`}
                  className="mt-8 inline-block px-7 py-3 text-[12px] uppercase tracking-[0.32em] font-bold"
                  style={{
                    backgroundColor: block.ctaBg,
                    color: block.ctaFg,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  Découvrir
                </Link>
              )}
            </div>
            <div
              className="relative aspect-[5/4] overflow-hidden"
              style={{
                backgroundColor: idx % 2 === 0 ? theme.colors.onyx : theme.colors.surface,
                borderRadius: theme.radius.tile,
              }}
            >
              {block.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.image}
                  alt={block.headline}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-6xl"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  aria-hidden
                >
                  {store.logoEmoji || '◆'}
                </div>
              )}
            </div>
          </div>
        </section>
      ))}

      {/* ============== FACILITY STRIP — 4 tiles ====================== */}
      <section
        className="px-6 sm:px-10 py-16"
        style={{ backgroundColor: accent, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h3
              className="font-extrabold uppercase tracking-[0.04em] leading-tight"
              style={{
                color: '#FFFFFF',
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              }}
            >
              Nos équipements
            </h3>
            <Link
              href={`/shop/${store.slug}`}
              className="text-[12px] uppercase tracking-[0.32em] font-bold border-b pb-1"
              style={{ color: '#FFFFFF', borderColor: '#FFFFFF' }}
            >
              Tout voir →
            </Link>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {strip.map((tile, i) => (
              <li
                key={i}
                className="relative aspect-square overflow-hidden"
                style={{
                  backgroundColor: theme.colors.onyx,
                  borderRadius: theme.radius.tile,
                }}
              >
                {tile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tile.image}
                    alt={tile.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-3xl"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    aria-hidden
                  >
                    {store.logoEmoji || '◆'}
                  </div>
                )}
                <div
                  className="absolute left-3 bottom-3 right-3 px-3 py-2 backdrop-blur-sm"
                  style={{
                    backgroundColor: 'rgba(18,18,20,0.6)',
                    color: '#FFFFFF',
                    borderRadius: theme.radius.tile,
                  }}
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] font-bold">
                    {tile.label}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============== FAST-ADD ====================================== */}
      {fastAdd && fastAddVariant && (
        <section
          className="px-6 sm:px-10 py-24 text-center"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <p
            className="text-[12px] uppercase tracking-[0.42em] font-bold mb-4"
            style={{ color: accent }}
          >
            Notre signature
          </p>
          <h2
            className="font-extrabold uppercase tracking-[0.02em] leading-[1.05] max-w-2xl mx-auto mb-10"
            style={{
              color: ink,
              fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
            }}
          >
            {fastAdd.title}
          </h2>
          <div className="max-w-xs mx-auto">
            <AddToCartButton
              variantId={fastAddVariant.id}
              storeSlug={store.slug}
            />
          </div>
        </section>
      )}

      {/* ============== TRIAL / NEWSLETTER ============================= */}
      <section
        className="px-6 sm:px-10 py-20"
        style={{ backgroundColor: theme.colors.onyx, color: '#FFFFFF' }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="text-[12px] uppercase tracking-[0.42em] font-bold mb-3"
            style={{ color: cyan }}
          >
            Essai gratuit
          </p>
          <h2
            className="font-extrabold uppercase tracking-[0.02em] leading-[1.05] mb-6"
            style={{
              color: '#FFFFFF',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
            }}
          >
            Bouge avec {store.name}
          </h2>
          <p
            className="text-base sm:text-lg font-light leading-[1.7] max-w-2xl mx-auto mb-10"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            {truncate(
              store.description ||
                store.tagline ||
                `Une approche ${store.niche || 'lifestyle'} pensée pour durer.`,
              200,
            )}
          </p>
          <form
            className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3"
            action={`/shop/${store.slug}`}
            method="get"
          >
            <input
              type="text"
              placeholder="Votre prénom"
              aria-label="Prénom"
              className="flex-1 px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-50"
              style={{
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#FFFFFF',
                borderRadius: theme.radius.pill,
              }}
            />
            <input
              type="email"
              required
              placeholder="Votre email"
              aria-label="Email"
              className="flex-1 px-4 py-3 text-sm font-light bg-transparent border outline-none placeholder:opacity-50"
              style={{
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#FFFFFF',
                borderRadius: theme.radius.pill,
              }}
            />
            <button
              type="submit"
              className="px-7 py-3 text-[12px] uppercase tracking-[0.32em] font-bold"
              style={{
                backgroundColor: accent,
                color: '#FFFFFF',
                borderRadius: theme.radius.pill,
              }}
            >
              Démarrer
            </button>
          </form>
        </div>
      </section>

      {/* ============== FOOTER — onyx with magenta accents ============= */}
      <footer
        className="px-6 sm:px-10 py-14"
        style={{ backgroundColor: theme.colors.onyxSoft, color: '#FFFFFF' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          <div>
            <p
              className="text-base font-extrabold uppercase tracking-[0.32em] mb-4"
              style={{ color: '#FFFFFF' }}
            >
              {wordmark}
            </p>
            <p
              className="text-sm font-light leading-[1.85]"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {truncate(
                store.description ||
                  store.tagline ||
                  `${store.name} · une approche athlétique du quotidien.`,
                160,
              )}
            </p>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-bold mb-4"
              style={{ color: accent }}
            >
              Suivez-nous
            </p>
            <ul
              className="space-y-2 text-sm font-light"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              <li>Instagram</li>
              <li>Facebook</li>
              <li>TikTok</li>
              <li>YouTube</li>
            </ul>
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.32em] font-bold mb-4"
              style={{ color: accent }}
            >
              L&apos;univers
            </p>
            <ul
              className="space-y-2 text-sm font-light"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              <li>Boutique</li>
              <li>Membres</li>
              <li>Contact</li>
              <li>FAQ</li>
            </ul>
          </div>
        </div>
        <div
          className="max-w-6xl mx-auto pt-6 text-xs font-light flex flex-col sm:flex-row sm:justify-between gap-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <p>
            © {new Date().getFullYear()} {store.name}. Tous droits réservés.
          </p>
          <p className="uppercase tracking-[0.28em]">
            {store.niche || 'Athletic'}
          </p>
        </div>
      </footer>
    </div>
  );
}

interface Block {
  kicker: string;
  headline: string;
  body: string;
  bg: string;
  fg: string;
  kickerColor: string;
  bodyColor: string;
  ctaBg: string;
  ctaFg: string;
  image?: string | null;
  linkHandle?: string | null;
}

function buildBlocks(
  store: StoreConfig,
  products: WellnessOnyxGymProduct[],
): Block[] {
  const points = (store.landingContent?.selling_points || []).slice(0, 3);
  const defaults = [
    {
      kicker: `L'expérience ${store.name}`.toUpperCase(),
      headline: 'Une approche complète',
      body: `Du premier rendez-vous au suivi long terme, ${store.name} accompagne sans pression.`,
      bg: theme.colors.cyan,
      fg: theme.colors.onyx,
      kickerColor: theme.colors.onyx,
      bodyColor: theme.colors.onyxSoft,
      ctaBg: theme.colors.onyx,
      ctaFg: '#FFFFFF',
    },
    {
      kicker: 'Pour tous les niveaux',
      headline: 'Fitness for everyone',
      body: `Une démarche inclusive pensée pour ${store.niche || 'tous les profils'}, du débutant au pratiquant assidu.`,
      bg: theme.colors.onyx,
      fg: '#FFFFFF',
      kickerColor: theme.colors.accent,
      bodyColor: 'rgba(255,255,255,0.78)',
      ctaBg: theme.colors.accent,
      ctaFg: '#FFFFFF',
    },
    {
      kicker: 'Équipement premium',
      headline: 'Du matériel sans compromis',
      body: `Sélection serrée, contrôle qualité réel et exigence de cohérence — ${store.name} privilégie les pièces durables.`,
      bg: theme.colors.accent,
      fg: '#FFFFFF',
      kickerColor: '#FFFFFF',
      bodyColor: 'rgba(255,255,255,0.85)',
      ctaBg: '#FFFFFF',
      ctaFg: theme.colors.accent,
    },
  ];
  return defaults.map((d, i) => {
    const p = points[i];
    const product = products[i] || products[0];
    return {
      ...d,
      kicker: p ? p.title.toUpperCase() : d.kicker,
      headline: p ? p.title : d.headline,
      body: p ? p.body : d.body,
      image: product?.thumbnail || product?.images?.[0]?.url || null,
      linkHandle: product?.handle || null,
    };
  });
}

function buildStrip(
  store: StoreConfig,
  products: WellnessOnyxGymProduct[],
): Array<{ image?: string | null; label: string }> {
  const labels = ['Cardio', 'Force', 'Mobilité', 'Récupération'];
  return labels.map((label, i) => {
    const src =
      store.lifestyleImages[i] ||
      products[i + 1]?.thumbnail ||
      products[i + 1]?.images?.[0]?.url ||
      null;
    return { image: src, label };
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
