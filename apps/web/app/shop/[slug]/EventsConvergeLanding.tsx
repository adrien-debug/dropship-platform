import Link from 'next/link';
import { Inter, Manrope } from 'next/font/google';
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

export interface EventsConvergeProduct {
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
  products: EventsConvergeProduct[];
}

/**
 * Events Converge Landing — port of the Wix "Marketing Webinar (Yellow)"
 * template (https://fr.wix.com/website-template/view/html/wh-1239, events
 * category).
 *
 * Design grammar lifted from the source:
 *   - Modular card system on a near-black background. The hero is a
 *     "card collage" — one black headline card, one blue spiral card,
 *     one yellow accent card, one white card. Each card lives in a
 *     rounded slab.
 *   - The page is a sequence of card grids: "Beyond the Metrics" → 4
 *     small cards → "Proven Results for Our Attendees" → speaker block →
 *     yellow circle + "The Art of the Automated Funnel" → quotes → final
 *     CTA in yellow.
 *   - The vibe is bold sans-serif, generous padding, geometric circles
 *     and dots, soft monolithic surfaces.
 *
 * Mapping to our slot system:
 *   - Card 1: store.tagline / hero CTA
 *   - Card 2: hero image (blue spiral fallback)
 *   - Card 3 (yellow): formatted price of the hero product
 *   - Card 4 (white): trust micro-copy
 *   - Following sections cycle products into "what you'll master" tiles.
 */

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-converge-body',
  display: 'swap',
});

const display = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-converge-display',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#0E0E10',
    surface: '#FFFFFF',
    ink: '#0E0E10',
    inkSoft: '#1E1E22',
    muted: '#8E8E93',
    line: '#2A2A2E',
    accent: '#F4F162', // bright yellow
    blue: '#9BB6FF', // soft blue spiral card
    blueDeep: '#2D4DD8',
  },
  radius: { card: 28, button: 9999, pill: 9999 },
} as const;

export function EventsConvergeLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const fontDisplay = `${display.style.fontFamily}, "Manrope", "Inter", sans-serif`;
  const fontBody = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`;

  const firstProduct = products[0];
  const variant = firstProduct?.variants?.[0];
  const firstPrice = variant?.calculated_price?.calculated_amount;
  const firstCurrency = variant?.calculated_price?.currency_code || 'eur';
  const formattedFirstPrice =
    firstPrice !== undefined ? formatMoney(firstPrice, firstCurrency) : null;

  const sellingPoints = (store.landingContent?.selling_points ?? []).slice(0, 4);
  const fallbackPoints = [
    { title: 'Conversion First Funnel', body: store.tagline || 'Une selection qui convertit avant de plaire.' },
    { title: 'Psychographic Targeting', body: 'Pieces calibrees pour un type de client precis.' },
    { title: 'ROI Driven Content', body: 'Chaque visuel et copy tracker, A/B teste et itere.' },
    { title: 'Premium Care', body: 'Service client, retours et echanges sous 14 jours.' },
  ];
  const tiles = sellingPoints.length >= 2 ? sellingPoints : fallbackPoints;

  return (
    <div
      className={`${display.variable} ${inter.variable}`}
      style={{
        background: theme.colors.bg,
        color: theme.colors.surface,
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: fontDisplay,
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: accent,
              display: 'inline-block',
            }}
            aria-hidden
          />
          {store.name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 13,
            color: '#C9C9D1',
          }}
        >
          <span>Programme</span>
          <span>Pieces</span>
          <span>Methode</span>
          <Link
            href={`/shop/${store.slug}`}
            style={{
              background: theme.colors.surface,
              color: theme.colors.ink,
              padding: '10px 18px',
              borderRadius: theme.radius.pill,
              fontFamily: fontDisplay,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Reserver
          </Link>
        </div>
      </nav>

      {/* ============== HERO CARDS ============== */}
      <section style={{ padding: '24px 24px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gridTemplateRows: 'auto auto',
            gap: 16,
            maxWidth: 1440,
            margin: '0 auto',
          }}
        >
          {/* main headline card */}
          <div
            style={{
              gridRow: 'span 2',
              background: theme.colors.surface,
              color: theme.colors.ink,
              borderRadius: theme.radius.card,
              padding: '56px 48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 480,
            }}
          >
            <p
              style={{
                fontFamily: fontBody,
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: 0,
              }}
            >
              {store.niche}
            </p>
            <h1
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(48px, 6.4vw, 96px)',
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              {store.tagline || `${store.name} — la selection ${store.niche.toLowerCase()}`}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link
                href={firstProduct ? `/shop/${store.slug}/products/${firstProduct.handle}` : `/shop/${store.slug}`}
                style={{
                  display: 'inline-block',
                  padding: '14px 24px',
                  background: theme.colors.ink,
                  color: theme.colors.surface,
                  borderRadius: theme.radius.pill,
                  fontFamily: fontDisplay,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Voir la collection
              </Link>
              {formattedFirstPrice && (
                <span
                  style={{
                    fontFamily: fontBody,
                    fontSize: 13,
                    color: theme.colors.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  A partir de {formattedFirstPrice}
                </span>
              )}
            </div>
          </div>

          {/* spiral / image card */}
          <div
            style={{
              background: theme.colors.blue,
              borderRadius: theme.radius.card,
              minHeight: 232,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={store.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
              />
            ) : (
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', display: 'block' }}>
                {Array.from({ length: 36 }).map((_, i) => {
                  const r = 8 + i * 2.4;
                  return (
                    <circle
                      key={i}
                      cx={100}
                      cy={100}
                      r={r}
                      fill="none"
                      stroke={theme.colors.blueDeep}
                      strokeWidth={1.2}
                      opacity={0.35 + Math.min(0.5, i * 0.015)}
                    />
                  );
                })}
              </svg>
            )}
          </div>

          {/* yellow + white pair below image card */}
          <div
            style={{
              background: accent,
              color: theme.colors.ink,
              borderRadius: theme.radius.card,
              padding: 32,
              minHeight: 232,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <p
              style={{
                fontFamily: fontBody,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                margin: 0,
                fontWeight: 600,
              }}
            >
              Pieces phares
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(32px, 3.6vw, 48px)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {products.length} edition{products.length > 1 ? 's' : ''}
            </p>
            <p
              style={{
                fontFamily: fontBody,
                fontSize: 13,
                lineHeight: 1.5,
                margin: 0,
                opacity: 0.85,
              }}
            >
              Curatees pour {store.niche.toLowerCase()}, livrees vite, premium.
            </p>
          </div>
        </div>
      </section>

      {/* ============== BEYOND METRICS — TILES ============== */}
      <section style={{ padding: '120px 24px 80px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: 'clamp(40px, 5.2vw, 72px)',
              letterSpacing: '-0.02em',
              margin: '0 0 56px',
            }}
          >
            What you&apos;ll master
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {tiles.map((tile, idx) => {
              const isAccent = idx % 4 === 1;
              return (
                <div
                  key={idx}
                  style={{
                    background: isAccent ? accent : theme.colors.surface,
                    color: theme.colors.ink,
                    borderRadius: theme.radius.card,
                    padding: 32,
                    minHeight: 220,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: fontDisplay,
                      fontWeight: 600,
                      fontSize: 14,
                      color: isAccent ? theme.colors.ink : theme.colors.muted,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    0{idx + 1}
                  </span>
                  <h3
                    style={{
                      fontFamily: fontDisplay,
                      fontWeight: 700,
                      fontSize: 22,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                      margin: 0,
                    }}
                  >
                    {tile.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: 13,
                      color: isAccent ? theme.colors.ink : theme.colors.muted,
                      lineHeight: 1.5,
                      margin: 0,
                      opacity: isAccent ? 0.85 : 1,
                    }}
                  >
                    {tile.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== PROVEN RESULTS / CATALOG ============== */}
      <section style={{ padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <div
            style={{
              background: theme.colors.surface,
              color: theme.colors.ink,
              borderRadius: theme.radius.card,
              padding: '56px 48px',
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontFamily: fontBody,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '0 0 16px',
                fontWeight: 600,
              }}
            >
              La selection
            </p>
            <h2
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(36px, 4.6vw, 60px)',
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.05,
              }}
            >
              Proven pieces for our attendees
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {products.map((product, idx) => {
              const v = product.variants?.[0];
              const price = v?.calculated_price?.calculated_amount;
              const currency = v?.calculated_price?.currency_code || 'eur';
              const formatted = price !== undefined ? formatMoney(price, currency) : null;
              const image = product.thumbnail || product.images?.[0]?.url;
              return (
                <Link
                  key={product.id}
                  href={`/shop/${store.slug}/products/${product.handle}`}
                  style={{
                    background: theme.colors.surface,
                    color: theme.colors.ink,
                    borderRadius: theme.radius.card,
                    padding: 24,
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '4 / 3',
                      background: idx % 3 === 0 ? theme.colors.blue : '#F3F3F5',
                      borderRadius: 16,
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
                      letterSpacing: '-0.01em',
                      margin: '0 0 6px',
                    }}
                  >
                    {product.title}
                  </h3>
                  {formatted && (
                    <p
                      style={{
                        fontFamily: fontBody,
                        fontSize: 13,
                        color: theme.colors.muted,
                        margin: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatted}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============== THE ART OF THE AUTOMATED FUNNEL ============== */}
      <section style={{ padding: '40px 24px 80px' }}>
        <div
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            background: theme.colors.surface,
            color: theme.colors.ink,
            borderRadius: theme.radius.card,
            padding: '80px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 32,
          }}
        >
          <div
            style={{
              width: 280,
              height: 280,
              maxWidth: '60vw',
              borderRadius: '50%',
              background: accent,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {Array.from({ length: 18 }).map((_, i) => {
                const r = 14 + i * 5;
                return (
                  <circle
                    key={i}
                    cx={100}
                    cy={100}
                    r={r}
                    fill="none"
                    stroke="rgba(14,14,16,0.35)"
                    strokeWidth={0.8}
                  />
                );
              })}
            </svg>
            <span
              style={{
                position: 'relative',
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.ink,
              }}
            >
              {store.logoEmoji || store.name.slice(0, 1)}
            </span>
          </div>
          <h3
            style={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: 'clamp(32px, 4.2vw, 56px)',
              letterSpacing: '-0.02em',
              margin: 0,
              maxWidth: 680,
              lineHeight: 1.05,
            }}
          >
            {store.tagline || `L'art de la selection ${store.niche.toLowerCase()}`}
          </h3>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: 15,
              color: theme.colors.muted,
              lineHeight: 1.6,
              maxWidth: 540,
              margin: 0,
            }}
          >
            {store.description?.slice(0, 220) ||
              `Une approche curatee de la niche ${store.niche.toLowerCase()}, choisie pour resister au bruit du marche.`}
          </p>
          {firstProduct?.variants?.[0] && (
            <div style={{ maxWidth: 320, width: '100%' }}>
              <AddToCartButton
                variantId={firstProduct.variants[0].id}
                storeSlug={store.slug}
              />
            </div>
          )}
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section style={{ padding: '40px 24px 80px' }}>
        <div
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            background: accent,
            color: theme.colors.ink,
            borderRadius: theme.radius.card,
            padding: '80px 48px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: fontBody,
              fontSize: 11,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              fontWeight: 600,
              margin: '0 0 24px',
            }}
          >
            Le rendez-vous
          </p>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontWeight: 800,
              fontSize: 'clamp(64px, 10vw, 168px)',
              letterSpacing: '-0.04em',
              lineHeight: 0.92,
              margin: 0,
            }}
          >
            Converge
            <br />
            And Convert
          </h2>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer
        style={{
          padding: '40px 32px',
          fontSize: 11,
          letterSpacing: '0.2em',
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

export default EventsConvergeLanding;
