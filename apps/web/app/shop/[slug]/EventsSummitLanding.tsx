import Link from 'next/link';
import { Inter, Space_Grotesk } from 'next/font/google';
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

export interface EventsSummitProduct {
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
  products: EventsSummitProduct[];
}

/**
 * Events Summit Landing — port of the Wix "Accelerating Climate Change"
 * webinar template (https://fr.wix.com/website-template/view/html/wh-1168,
 * events category).
 *
 * Design grammar lifted from the source:
 *   - Conference / summit register. Soft sage green background panels
 *     punctuated by a deep teal slab. Big sans display ("Accelerating
 *     Climate Change") on a sage card with a small grid overlay.
 *   - Three layers of structure: "Why attend?" feature rail (4 bullets
 *     stacked), "Speakers" grid, "On the Agenda" deep-green slab with a
 *     timeline of bullets, and a yellow "Tickets" panel showing two
 *     price tiers, then a CTA newsletter band in neon yellow.
 *   - Decorative dotted-grid background on hero. We rebuild it with SVG.
 *
 * The summit / webinar grammar maps well to a "drop launch" or "season
 * collection" with reasons-to-buy + product cards + pricing panel. All
 * copy comes from `store.*` — Wix's "Why attend" reasons become the
 * `landingContent.selling_points` block.
 */

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-summit-body',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-summit-display',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#FFFFFF',
    surface: '#D5DDC8', // sage green card
    sageDeep: '#9FB495',
    ink: '#1F2D2E', // deep teal / nearly-black
    inkSlab: '#23332E', // dark slab background
    muted: '#5E6A6B',
    accent: '#F4F162', // neon yellow (newsletter band / tickets)
    line: 'rgba(31,45,46,0.18)',
  },
  radius: { card: 8, button: 4 },
} as const;

export function EventsSummitLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const fontDisplay = `${display.style.fontFamily}, "Space Grotesk", "Inter", sans-serif`;
  const fontBody = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`;

  const firstProduct = products[0];
  const secondProduct = products[1] || products[0];

  const sellingPoints = (store.landingContent?.selling_points ?? []).slice(0, 4);
  const fallbackPoints = [
    { title: 'Acces curate', body: `Une selection ${store.niche.toLowerCase()} resserree, sans bruit, sans filler.` },
    { title: 'Tactiques actionnables', body: store.tagline || 'Des pieces qui s\'integrent dans une routine quotidienne.' },
    { title: 'Exemples reels', body: 'Chaque piece est testee, photographiee et calibree avant publication.' },
    { title: 'Reponses rapides', body: 'Service client en moins de 24h sur tout ce que vous achetez.' },
  ];
  const pointsToRender = sellingPoints.length >= 2 ? sellingPoints : fallbackPoints;

  return (
    <div
      className={`${display.variable} ${inter.variable}`}
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
          padding: '20px 32px',
        }}
      >
        <span
          style={{
            fontFamily: fontDisplay,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.01em',
          }}
        >
          {store.name}
        </span>
        <div
          style={{
            display: 'flex',
            gap: 28,
            fontSize: 12,
            fontFamily: fontBody,
            color: theme.colors.muted,
          }}
        >
          <span>Programme</span>
          <span>Pieces</span>
          <span>Tarifs</span>
          <span>Contact</span>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section style={{ padding: '24px 32px 0' }}>
        <div
          style={{
            background: theme.colors.surface,
            borderRadius: theme.radius.card,
            padding: '64px 48px',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 'clamp(360px, 50vh, 520px)',
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: 40,
            alignItems: 'center',
          }}
        >
          {/* dotted grid background */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25, pointerEvents: 'none' }}
            aria-hidden
          >
            <defs>
              <pattern id="summit-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill={theme.colors.ink} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#summit-dots)" />
          </svg>
          <div style={{ position: 'relative' }}>
            <h1
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(48px, 7.2vw, 104px)',
                lineHeight: 1.02,
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              {store.tagline || `${store.name} ${store.niche.toLowerCase()} session`}
            </h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
              <Link
                href={firstProduct ? `/shop/${store.slug}/products/${firstProduct.handle}` : `/shop/${store.slug}`}
                style={{
                  display: 'inline-block',
                  padding: '14px 22px',
                  background: theme.colors.ink,
                  color: theme.colors.surface,
                  fontFamily: fontBody,
                  fontSize: 12,
                  letterSpacing: '0.02em',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: theme.radius.button,
                }}
              >
                Reserver une piece
              </Link>
              <Link
                href={`/shop/${store.slug}`}
                style={{
                  display: 'inline-block',
                  padding: '14px 22px',
                  border: `1.5px solid ${theme.colors.ink}`,
                  color: theme.colors.ink,
                  fontFamily: fontBody,
                  fontSize: 12,
                  letterSpacing: '0.02em',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: theme.radius.button,
                  background: 'transparent',
                }}
              >
                Voir le programme
              </Link>
            </div>
          </div>
          {heroImage && (
            <div
              style={{
                position: 'relative',
                aspectRatio: '4 / 5',
                background: theme.colors.sageDeep,
                borderRadius: theme.radius.card,
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={store.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ============== WHY ATTEND ============== */}
      <section style={{ padding: '120px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 64,
            alignItems: 'start',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: fontBody,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '0 0 16px',
              }}
            >
              {store.niche}
            </p>
            <h2
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(32px, 4.2vw, 56px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Pourquoi y aller ?
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 0,
            }}
          >
            {pointsToRender.map((point, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 2fr',
                  gap: 24,
                  padding: '24px 0',
                  borderTop: `1px solid ${theme.colors.line}`,
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontFamily: fontDisplay,
                    fontWeight: 500,
                    fontSize: 14,
                    color: theme.colors.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3
                  style={{
                    fontFamily: fontDisplay,
                    fontWeight: 600,
                    fontSize: 20,
                    letterSpacing: '-0.01em',
                    margin: 0,
                  }}
                >
                  {point.title}
                </h3>
                <p
                  style={{
                    fontFamily: fontBody,
                    fontSize: 14,
                    color: theme.colors.muted,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {point.body}
                </p>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${theme.colors.line}`, height: 1 }} />
          </div>
        </div>
      </section>

      {/* ============== CATALOGUE (speakers grid) ============== */}
      <section style={{ padding: '80px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <p
          style={{
            fontFamily: fontBody,
            fontSize: 11,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: theme.colors.muted,
            margin: '0 0 16px',
          }}
        >
          La selection
        </p>
        <h2
          style={{
            fontFamily: fontDisplay,
            fontWeight: 700,
            fontSize: 'clamp(40px, 5.6vw, 72px)',
            letterSpacing: '-0.02em',
            margin: '0 0 56px',
          }}
        >
          Les pieces
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 40,
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
                style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 5',
                    background: theme.colors.surface,
                    borderRadius: theme.radius.card,
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
                <h3
                  style={{
                    fontFamily: fontDisplay,
                    fontWeight: 600,
                    fontSize: 18,
                    margin: '0 0 6px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {product.title}
                </h3>
                {formattedPrice && (
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 13,
                      color: theme.colors.muted,
                      margin: 0,
                      fontVariantNumeric: 'tabular-nums',
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

      {/* ============== AGENDA (dark slab) ============== */}
      <section
        style={{
          background: theme.colors.inkSlab,
          color: theme.colors.surface,
          padding: '120px 32px',
          marginTop: 80,
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: 11,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'rgba(213,221,200,0.65)',
              margin: '0 0 16px',
            }}
          >
            Le programme
          </p>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: 'clamp(40px, 5.6vw, 64px)',
              letterSpacing: '-0.02em',
              margin: '0 0 56px',
            }}
          >
            Au menu
          </h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pointsToRender.map((point, idx) => (
              <li
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr',
                  gap: 32,
                  padding: '28px 0',
                  borderTop: `1px solid rgba(213,221,200,0.18)`,
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontFamily: fontDisplay,
                    fontWeight: 500,
                    fontSize: 14,
                    color: accent,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                  }}
                >
                  {`${String(idx * 25).padStart(2, '0')}:00`}
                </span>
                <div>
                  <h3
                    style={{
                      fontFamily: fontDisplay,
                      fontWeight: 600,
                      fontSize: 20,
                      margin: '0 0 6px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {point.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 14,
                      color: 'rgba(213,221,200,0.7)',
                      lineHeight: 1.6,
                      margin: 0,
                      maxWidth: 540,
                    }}
                  >
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
            <li style={{ borderTop: `1px solid rgba(213,221,200,0.18)`, height: 1 }} />
          </ol>
        </div>
      </section>

      {/* ============== TICKETS (yellow panel) ============== */}
      <section style={{ padding: '120px 32px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: 11,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: theme.colors.muted,
              margin: '0 0 16px',
            }}
          >
            Pieces phares
          </p>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: 'clamp(40px, 5.6vw, 64px)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Choisissez votre place
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {[firstProduct, secondProduct]
            .filter((p): p is EventsSummitProduct => Boolean(p))
            .map((product, idx) => {
              const variant = product.variants?.[0];
              const price = variant?.calculated_price?.calculated_amount;
              const currency = variant?.calculated_price?.currency_code || 'eur';
              const formattedPrice =
                price !== undefined ? formatMoney(price, currency) : null;
              return (
                <div
                  key={`${product.id}-${idx}`}
                  style={{
                    background: idx === 1 ? accent : theme.colors.surface,
                    borderRadius: theme.radius.card,
                    padding: '40px 32px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 11,
                      letterSpacing: '0.28em',
                      textTransform: 'uppercase',
                      color: theme.colors.ink,
                      margin: '0 0 8px',
                      opacity: 0.7,
                    }}
                  >
                    {idx === 1 ? 'Acces premium' : 'Acces classique'}
                  </p>
                  <h3
                    style={{
                      fontFamily: fontDisplay,
                      fontWeight: 700,
                      fontSize: 'clamp(40px, 5vw, 56px)',
                      margin: '0 0 16px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formattedPrice || product.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 13,
                      color: theme.colors.muted,
                      lineHeight: 1.5,
                      margin: '0 0 24px',
                      maxWidth: 240,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  >
                    {product.title}
                  </p>
                  {product.variants?.[0] ? (
                    <AddToCartButton
                      variantId={product.variants[0].id}
                      storeSlug={store.slug}
                    />
                  ) : null}
                </div>
              );
            })}
        </div>
      </section>

      {/* ============== NEWSLETTER ============== */}
      <section
        style={{
          background: accent,
          padding: '80px 32px',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontFamily: fontDisplay,
            fontWeight: 700,
            fontSize: 'clamp(40px, 5.6vw, 72px)',
            letterSpacing: '-0.02em',
            margin: 0,
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
            color: theme.colors.ink,
            lineHeight: 1,
          }}
        >
          {store.tagline ? store.tagline.split(' ').slice(0, 4).join(' ') : `Reservez votre piece ${store.niche.toLowerCase()}`}
        </h3>
      </section>

      {/* ============== FOOTER ============== */}
      <footer
        style={{
          padding: '40px 32px',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: theme.colors.muted,
          fontFamily: fontBody,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
          borderTop: `1px solid ${theme.colors.line}`,
        }}
      >
        <span>{store.name}</span>
        <span>Mentions legales</span>
        <span>Confidentialite</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default EventsSummitLanding;
