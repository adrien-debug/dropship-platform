import Link from 'next/link';
import { Inter, Bebas_Neue } from 'next/font/google';
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

export interface EventsMusicartProduct {
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
  products: EventsMusicartProduct[];
}

/**
 * Events Musicart Landing — port of the Wix "Le Musicart" template
 * (https://fr.wix.com/website-template/view/html/2174, events category).
 *
 * Design grammar lifted from the source:
 *   - Dark slate background (near-black) with a coral / salmon accent block
 *     that hosts the hero CTA. The hero is a crowd photograph with the
 *     brand mark sitting in coral-tinted blocks at the left.
 *   - Bebas-style condensed sans display (Wix uses a custom condensed face);
 *     all caps for headings and the listing rows.
 *   - The body of the page is an "agenda" — a vertical list of events with
 *     a date label on the left, an event title, and a "billet" CTA on the
 *     right, separated by 1px hairlines. We repurpose the agenda as the
 *     storefront catalogue: each product becomes a row.
 *   - A coral newsletter band closes the page, plus a small footer.
 *
 * Every piece of copy is wired to `store.*` props. The Wix coral
 * (`#F4A28C`) is threaded through `theme.colors.accent` and overridden by
 * `store.primaryColor` / `store.accentColor` when those exist.
 */

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-musicart-body',
  display: 'swap',
});

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-musicart-display',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#16181F', // deep slate (Wix --color_2 equivalent)
    ink: '#FFFFFF',
    muted: '#9BA0AB',
    line: 'rgba(255,255,255,0.18)',
    accent: '#F4A28C', // Wix salmon / coral block
    accentDeep: '#E48B73',
  },
  radius: { card: 0, button: 0 },
} as const;

export function EventsMusicartLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const firstProduct = products[0];
  const featureVariant = firstProduct?.variants?.[0];
  const featurePrice = featureVariant?.calculated_price?.calculated_amount;
  const featureCurrency = featureVariant?.calculated_price?.currency_code || 'eur';
  const formattedFeaturePrice =
    featurePrice !== undefined ? formatMoney(featurePrice, featureCurrency) : null;

  const heroTitleTop = (store.tagline || store.name).toUpperCase();
  const heroTitleAccent = firstProduct?.title?.toUpperCase() ?? store.name.toUpperCase();

  const lede = store.description ||
    `Une selection ${store.niche.toLowerCase()} curatee piece par piece, sans bruit, sans compromis.`;

  const fontStack = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`;
  const displayStack = `${bebas.style.fontFamily}, "Bebas Neue", "Oswald", "Impact", sans-serif`;

  return (
    <div
      className={`${inter.variable} ${bebas.variable}`}
      style={{
        background: theme.colors.bg,
        color: theme.colors.ink,
        fontFamily: fontStack,
        minHeight: '100vh',
      }}
    >
      {/* ============== NAV ============== */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: `1px solid ${theme.colors.line}`,
        }}
      >
        <div
          style={{
            fontFamily: displayStack,
            letterSpacing: '0.14em',
            fontSize: 18,
            color: theme.colors.ink,
            textTransform: 'uppercase',
          }}
        >
          {store.name}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 28,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
          }}
        >
          <span>Programmation</span>
          <span>Lieu</span>
          <span>Contact</span>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section
        style={{
          position: 'relative',
          minHeight: 'clamp(420px, 62vh, 720px)',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 0,
          alignItems: 'stretch',
          borderBottom: `1px solid ${theme.colors.line}`,
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#1f2330',
          }}
        >
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={store.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(35%) contrast(1.05) brightness(0.85)',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background:
                  'radial-gradient(circle at 30% 40%, rgba(244,162,140,0.18), transparent 60%), #1d2030',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: '48px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <h1
              style={{
                fontFamily: displayStack,
                fontSize: 'clamp(48px, 8vw, 120px)',
                lineHeight: 0.92,
                letterSpacing: '-0.01em',
                margin: 0,
                maxWidth: 540,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 14px',
                  background: accent,
                  color: theme.colors.bg,
                }}
              >
                {firstWord(heroTitleTop)}
              </span>
              <br />
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 14px',
                  background: accent,
                  color: theme.colors.bg,
                }}
              >
                {restWords(heroTitleTop) || heroTitleAccent}
              </span>
            </h1>
            <p
              style={{
                fontFamily: fontStack,
                fontSize: 12,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
              }}
            >
              {store.niche}
            </p>
          </div>
        </div>
        <div
          style={{
            background: accent,
            color: theme.colors.bg,
            padding: '52px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 22,
          }}
        >
          <p
            style={{
              fontFamily: fontStack,
              fontSize: 11,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Selection en cours
          </p>
          <p
            style={{
              fontFamily: displayStack,
              fontSize: 'clamp(28px, 3.4vw, 44px)',
              lineHeight: 1.05,
              letterSpacing: '0.01em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            {firstProduct?.title || store.tagline || store.name}
          </p>
          {formattedFeaturePrice && (
            <p
              style={{
                fontFamily: fontStack,
                fontSize: 18,
                fontVariantNumeric: 'tabular-nums',
                margin: 0,
              }}
            >
              {formattedFeaturePrice}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            {firstProduct ? (
              <Link
                href={`/shop/${store.slug}/products/${firstProduct.handle}`}
                style={{
                  display: 'inline-block',
                  padding: '14px 22px',
                  border: `1px solid ${theme.colors.bg}`,
                  fontFamily: fontStack,
                  fontSize: 11,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: theme.colors.bg,
                  textDecoration: 'none',
                }}
              >
                Decouvrir la piece
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ============== AGENDA / CATALOGUE LIST ============== */}
      <section style={{ padding: '120px 32px 80px', maxWidth: 1240, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 56,
          }}
        >
          <h2
            style={{
              fontFamily: displayStack,
              fontSize: 'clamp(36px, 5vw, 64px)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            <span style={{ background: '#fff', color: theme.colors.bg, padding: '0 16px' }}>
              Le
            </span>{' '}
            <span style={{ background: accent, color: theme.colors.bg, padding: '0 16px' }}>
              catalogue
            </span>
          </h2>
          <p
            style={{
              fontFamily: fontStack,
              fontSize: 11,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: theme.colors.muted,
              margin: 0,
            }}
          >
            {products.length} piece{products.length > 1 ? 's' : ''}
          </p>
        </div>

        <p
          style={{
            fontFamily: fontStack,
            fontSize: 14,
            color: theme.colors.muted,
            maxWidth: 620,
            lineHeight: 1.6,
            marginBottom: 48,
          }}
        >
          {lede}
        </p>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {products.map((product, idx) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const currency = variant?.calculated_price?.currency_code || 'eur';
            const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
            return (
              <li
                key={product.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 140px 140px',
                  alignItems: 'center',
                  padding: '28px 0',
                  borderTop: `1px solid ${theme.colors.line}`,
                  gap: 24,
                }}
              >
                <span
                  style={{
                    fontFamily: fontStack,
                    fontSize: 11,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: theme.colors.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  No. {String(idx + 1).padStart(2, '0')}
                </span>
                <Link
                  href={`/shop/${store.slug}/products/${product.handle}`}
                  style={{
                    fontFamily: displayStack,
                    fontSize: 'clamp(20px, 2vw, 26px)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: theme.colors.ink,
                    textDecoration: 'none',
                  }}
                >
                  {product.title}
                </Link>
                <span
                  style={{
                    fontFamily: fontStack,
                    fontSize: 14,
                    color: theme.colors.muted,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'right',
                  }}
                >
                  {formattedPrice || ''}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <Link
                    href={`/shop/${store.slug}/products/${product.handle}`}
                    style={{
                      display: 'inline-block',
                      padding: '10px 18px',
                      border: `1px solid ${accent}`,
                      color: accent,
                      fontFamily: fontStack,
                      fontSize: 10,
                      letterSpacing: '0.28em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Reserver
                  </Link>
                </div>
              </li>
            );
          })}
          <li style={{ borderTop: `1px solid ${theme.colors.line}`, height: 1 }} />
        </ol>

        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <Link
            href={`/shop/${store.slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 18,
              padding: '14px 24px',
              border: `1px solid ${theme.colors.line}`,
              color: theme.colors.ink,
              fontFamily: fontStack,
              fontSize: 11,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span aria-hidden>{'→'}</span> Voir plus
          </Link>
        </div>
      </section>

      {/* ============== NEWSLETTER BAND ============== */}
      <section style={{ background: accent, color: theme.colors.bg, padding: '64px 32px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) 2fr',
            gap: 40,
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: fontStack,
                fontSize: 11,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: 0,
              }}
            >
              Restez a jour
            </p>
            <h3
              style={{
                fontFamily: displayStack,
                fontSize: 'clamp(28px, 3vw, 40px)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                margin: '8px 0 0',
              }}
            >
              {store.tagline ? store.tagline.split(' ').slice(0, 5).join(' ') : 'Recevez les prochaines pieces'}
            </h3>
          </div>
          <div>
            {firstProduct?.variants?.[0] ? (
              <div style={{ maxWidth: 360 }}>
                <AddToCartButton
                  variantId={firstProduct.variants[0].id}
                  storeSlug={store.slug}
                />
              </div>
            ) : (
              <p style={{ fontFamily: fontStack, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {lede}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer
        style={{
          padding: '40px 32px',
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: theme.colors.muted,
          fontFamily: fontStack,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span>{store.name}</span>
        <span>Mentions legales</span>
        <span>Confidentialite</span>
        <span>Cookies</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

function firstWord(s: string): string {
  const trimmed = s.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return trimmed;
  return trimmed.slice(0, idx);
}

function restWords(s: string): string {
  const trimmed = s.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return '';
  return trimmed.slice(idx + 1).trim();
}

export default EventsMusicartLanding;
