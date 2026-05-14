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

export interface EventsBouquetProduct {
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
  products: EventsBouquetProduct[];
}

/**
 * Events Bouquet Landing — port of the Wix "Claire Bouquet — Photographe
 * Noces" template (https://fr.wix.com/website-template/view/html/1849,
 * events category).
 *
 * Design grammar lifted from the source:
 *   - Romantic editorial with a soft mint pastel band footer, generous
 *     white space, italic Cormorant serif for the wordmark, and tiny
 *     uppercase Inter for the kicker labels.
 *   - Hero is a single full-bleed editorial photograph of a centred
 *     subject (bouquet of flowers in the source) with the store name set
 *     above in italic serif. A small uppercase kicker reads the niche.
 *   - Below the hero, a four-up gallery of square photos previewing the
 *     "experience" — repurposed as a four-product editorial preview.
 *   - A pull-quote section centred with the testimonial-style quote in
 *     italic serif.
 *   - A mint band houses the contact / newsletter block.
 *
 * Wix uses `Cormorant Garamond` italic + a Helvetica W01 stand-in. We use
 * `Cormorant Garamond` directly + `Inter`.
 */

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-bouquet-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-bouquet-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FAF8F4',
    surface: '#FFFFFF',
    ink: '#2B2A28',
    muted: '#7E7B74',
    line: '#E7E3DB',
    accent: '#BFDBC8', // soft mint pastel
    accentDeep: '#9CC2AC',
  },
  radius: { card: 0, button: 9999 },
} as const;

export function EventsBouquetLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;

  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const galleryProducts = products.slice(0, 4);
  const firstProduct = products[0];
  const fontDisplay = `${cormorant.style.fontFamily}, "Cormorant Garamond", "EB Garamond", Georgia, serif`;
  const fontBody = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`;

  const quote = store.description ||
    `${store.tagline || `Une selection ${store.niche.toLowerCase()}`}, choisie comme on choisit un souvenir.`;

  return (
    <div
      className={`${cormorant.variable} ${inter.variable}`}
      style={{
        background: theme.colors.bg,
        color: theme.colors.ink,
        fontFamily: fontBody,
        minHeight: '100vh',
      }}
    >
      {/* ============== NAV ============== */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 36px',
        }}
      >
        <div
          style={{
            fontFamily: fontBody,
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
          }}
        >
          Editions
        </div>
        <div
          style={{
            fontFamily: fontDisplay,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: '0.01em',
          }}
        >
          {store.name}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
          }}
        >
          <span>Notes</span>
          <span>Contact</span>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section
        style={{
          padding: '24px 36px 0',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.36em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
            margin: '0 0 16px',
            fontWeight: 500,
          }}
        >
          {store.niche} {store.tagline ? `· ${store.tagline.split(' ').slice(0, 4).join(' ')}` : ''}
        </p>
        <h1
          style={{
            fontFamily: fontDisplay,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(56px, 9vw, 120px)',
            lineHeight: 1.02,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {store.name}
        </h1>
        <div
          style={{
            position: 'relative',
            marginTop: 36,
            aspectRatio: '4 / 3',
            maxWidth: 1180,
            marginLeft: 'auto',
            marginRight: 'auto',
            overflow: 'hidden',
            background: theme.colors.surface,
          }}
        >
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={store.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${accent}, ${theme.colors.surface})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.ink,
                fontFamily: fontDisplay,
                fontSize: 64,
                fontStyle: 'italic',
              }}
            >
              {store.logoEmoji || '♡'}
            </div>
          )}
        </div>
      </section>

      {/* ============== 4-UP GALLERY ============== */}
      {galleryProducts.length > 0 && (
        <section style={{ padding: '24px 36px', maxWidth: 1180, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {galleryProducts.map((product) => {
              const image = product.thumbnail || product.images?.[0]?.url;
              return (
                <Link
                  key={product.id}
                  href={`/shop/${store.slug}/products/${product.handle}`}
                  style={{
                    display: 'block',
                    aspectRatio: '1 / 1',
                    overflow: 'hidden',
                    background: theme.colors.surface,
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: fontDisplay,
                        fontStyle: 'italic',
                        fontSize: 24,
                        color: theme.colors.muted,
                      }}
                    >
                      {product.title.slice(0, 1)}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ============== CATALOGUE ============== */}
      <section style={{ padding: '120px 36px 80px', maxWidth: 980, margin: '0 auto' }}>
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
            margin: '0 0 16px',
            textAlign: 'center',
          }}
        >
          La collection
        </p>
        <h2
          style={{
            fontFamily: fontDisplay,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(36px, 5vw, 60px)',
            margin: '0 0 56px',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {store.tagline || `Notre regard sur ${store.niche.toLowerCase()}`}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 56,
          }}
        >
          {products.map((product) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const currency = variant?.calculated_price?.currency_code || 'eur';
            const formattedPrice =
              price !== undefined ? formatMoney(price, currency) : null;
            const image = product.thumbnail || product.images?.[0]?.url;
            return (
              <Link
                key={product.id}
                href={`/shop/${store.slug}/products/${product.handle}`}
                style={{
                  display: 'block',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    aspectRatio: '3 / 4',
                    background: theme.colors.surface,
                    overflow: 'hidden',
                    marginBottom: 18,
                  }}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
                <p
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                    color: theme.colors.muted,
                    margin: '0 0 6px',
                  }}
                >
                  {store.niche}
                </p>
                <h3
                  style={{
                    fontFamily: fontDisplay,
                    fontStyle: 'italic',
                    fontWeight: 500,
                    fontSize: 24,
                    margin: '0 0 8px',
                    lineHeight: 1.2,
                  }}
                >
                  {product.title}
                </h3>
                {formattedPrice && (
                  <p
                    style={{
                      fontSize: 12,
                      color: theme.colors.muted,
                      fontVariantNumeric: 'tabular-nums',
                      margin: 0,
                    }}
                  >
                    {formattedPrice}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============== PULL QUOTE ============== */}
      <section
        style={{
          background: accent,
          padding: '100px 36px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.36em',
            textTransform: 'uppercase',
            color: theme.colors.ink,
            margin: '0 0 24px',
            opacity: 0.6,
          }}
        >
          Le mot
        </p>
        <blockquote
          style={{
            fontFamily: fontDisplay,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(24px, 3.4vw, 36px)',
            lineHeight: 1.35,
            margin: 0,
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          « {quote} »
        </blockquote>
        <p
          style={{
            fontFamily: fontBody,
            fontSize: 11,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: theme.colors.ink,
            opacity: 0.7,
            marginTop: 28,
          }}
        >
          {store.name}
        </p>
      </section>

      {/* ============== CTA ============== */}
      <section style={{ padding: '120px 36px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.36em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
            margin: '0 0 16px',
          }}
        >
          Decouvrir une piece
        </p>
        <h3
          style={{
            fontFamily: fontDisplay,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(32px, 4vw, 56px)',
            margin: '0 0 40px',
            letterSpacing: '-0.01em',
          }}
        >
          {firstProduct?.title || store.name}
        </h3>
        {firstProduct?.variants?.[0] && (
          <div style={{ maxWidth: 320, margin: '0 auto' }}>
            <AddToCartButton
              variantId={firstProduct.variants[0].id}
              storeSlug={store.slug}
            />
          </div>
        )}
      </section>

      {/* ============== FOOTER ============== */}
      <footer
        style={{
          background: theme.colors.ink,
          color: theme.colors.bg,
          padding: '48px 36px',
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span style={{ fontFamily: fontDisplay, fontStyle: 'italic', fontSize: 18, letterSpacing: 'normal', textTransform: 'none' }}>
          {store.name}
        </span>
        <span>© {new Date().getFullYear()}</span>
        <span>Mentions legales</span>
        <span>Confidentialite</span>
      </footer>
    </div>
  );
}

export default EventsBouquetLanding;
