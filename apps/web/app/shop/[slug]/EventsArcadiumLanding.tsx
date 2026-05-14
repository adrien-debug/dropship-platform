import Link from 'next/link';
import { JetBrains_Mono, Inter } from 'next/font/google';
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

export interface EventsArcadiumProduct {
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
  products: EventsArcadiumProduct[];
}

/**
 * Events Arcadium Landing — port of the Wix "Kaelan's Birthday — Level 28
 * Unlocked" template (https://fr.wix.com/website-template/view/html/wh-1306,
 * events category).
 *
 * Design grammar lifted from the source:
 *   - Cyberpunk launch poster: pale lavender / very light gray background
 *     with a neon-yellow accent band at the top and a black bottom slab.
 *     Bold monospace display lock-up that reads like a "ticket" or
 *     "unlock event" notification. Centred subject with a soft beam-of-
 *     light spotlight.
 *   - Hero is a single massive headline "LEVEL 28 UNLOCKED" in a
 *     square-edged condensed mono / display face. We use JetBrains Mono
 *     Bold to channel the same tech-mech vibe.
 *   - Below the hero, structured data blocks ("DATE / TIME / LOCATION")
 *     in a centred stack. We repurpose these as a product spec showcase.
 *   - A "Dress Code" full-bleed black slab houses the catalogue (each
 *     product looking like a "command-line drop").
 *
 * Wix's design is highly conceptual; we keep the tech-y mood without
 * inventing niche copy. All headings are wired to `store.*` data.
 */

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-arcadium-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arcadium-body',
  display: 'swap',
});

const theme = {
  colors: {
    bg: '#E9E6F0', // pale lavender
    surface: '#FFFFFF',
    ink: '#0A0A0F',
    inkSoft: '#1B1A24',
    muted: '#5C5A6B',
    line: 'rgba(10,10,15,0.12)',
    accent: '#E2FF60', // neon yellow / lime
    accentDeep: '#C0E045',
  },
  radius: { card: 4, button: 4 },
} as const;

export function EventsArcadiumLanding({ store, products }: Props) {
  const accent = store.accentColor || store.primaryColor || theme.colors.accent;
  const heroImage =
    store.heroImageUrl ||
    products[0]?.thumbnail ||
    products[0]?.images?.[0]?.url ||
    store.cutoutImageUrl;

  const fontDisplay = `${mono.style.fontFamily}, "JetBrains Mono", "IBM Plex Mono", monospace`;
  const fontBody = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`;

  const firstProduct = products[0];
  const dropTitle = (firstProduct?.title || store.tagline || `${store.name} drop`).toUpperCase();
  const eventLine = store.tagline ? store.tagline.toUpperCase() : `${store.niche.toUpperCase()} EDITION`;

  return (
    <div
      className={`${mono.variable} ${inter.variable}`}
      style={{
        background: theme.colors.bg,
        color: theme.colors.ink,
        fontFamily: fontBody,
        minHeight: '100vh',
      }}
    >
      {/* ============== TOP TICKER ============== */}
      <div
        style={{
          background: accent,
          color: theme.colors.ink,
          padding: '8px 24px',
          fontFamily: fontDisplay,
          fontSize: 11,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          textAlign: 'center',
          fontWeight: 700,
        }}
      >
        {store.name.toUpperCase()} · {store.niche.toUpperCase()} · LIVE NOW
      </div>

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
            fontSize: 13,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {store.name}
        </span>
        <button
          aria-label="menu"
          style={{
            border: `1.5px solid ${theme.colors.ink}`,
            background: 'transparent',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 16, height: 1.5, background: theme.colors.ink }} />
          <span style={{ width: 16, height: 1.5, background: theme.colors.ink }} />
          <span style={{ width: 16, height: 1.5, background: theme.colors.ink }} />
        </button>
      </nav>

      {/* ============== HERO ============== */}
      <section
        style={{
          padding: '40px 32px 80px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <h1
          style={{
            fontFamily: fontDisplay,
            fontWeight: 800,
            fontSize: 'clamp(48px, 11vw, 168px)',
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          {eventLine}
        </h1>
        <div
          style={{
            position: 'relative',
            marginTop: 56,
            minHeight: 'clamp(280px, 42vh, 480px)',
          }}
        >
          {/* Beam-of-light spotlight */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(255,255,255,0.65), transparent 70%)',
              pointerEvents: 'none',
            }}
            aria-hidden
          />
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={store.name}
              style={{
                position: 'relative',
                maxHeight: 460,
                maxWidth: '100%',
                margin: '0 auto',
                display: 'block',
                filter: 'contrast(1.05)',
              }}
            />
          ) : (
            <div
              style={{
                position: 'relative',
                fontFamily: fontDisplay,
                fontSize: 'clamp(120px, 22vw, 280px)',
                fontWeight: 800,
                opacity: 0.16,
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {store.logoEmoji || '◢'}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 0,
              maxWidth: 280,
              textAlign: 'left',
              fontFamily: fontDisplay,
              fontSize: 11,
              letterSpacing: '0.04em',
              lineHeight: 1.5,
              color: theme.colors.muted,
            }}
          >
            {store.description?.slice(0, 160) ||
              `${store.tagline || 'Une selection curatee'}. Acces limite, allocation reduite.`}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 0,
            }}
          >
            <Link
              href={firstProduct ? `/shop/${store.slug}/products/${firstProduct.handle}` : `/shop/${store.slug}`}
              style={{
                display: 'inline-block',
                padding: '14px 22px',
                background: theme.colors.ink,
                color: theme.colors.bg,
                fontFamily: fontDisplay,
                fontSize: 10,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontWeight: 700,
                textDecoration: 'none',
                border: `1.5px solid ${theme.colors.ink}`,
              }}
            >
              Confirm Your Entry
            </Link>
          </div>
        </div>
      </section>

      {/* ============== SPEC BLOCK ============== */}
      <section style={{ padding: '120px 32px 80px', textAlign: 'center' }}>
        <div style={{ display: 'grid', gap: 48, maxWidth: 540, margin: '0 auto' }}>
          <div>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 10,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '0 0 8px',
              }}
            >
              Date :
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(28px, 4vw, 44px)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              {formatNowAsEventDate()}
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '8px 0 0',
              }}
            >
              {formatTodayWeekday()}
            </p>
          </div>
          <div>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 10,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '0 0 8px',
              }}
            >
              Drop :
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(28px, 4vw, 44px)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              {dropTitle.slice(0, 40)}
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '8px 0 0',
              }}
            >
              Edition limitee
            </p>
          </div>
          <div>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 10,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '0 0 8px',
              }}
            >
              Location :
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(28px, 4vw, 44px)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              The Arcadium
            </p>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: theme.colors.muted,
                margin: '8px 0 0',
              }}
            >
              Sector 7-G / Neon District
            </p>
          </div>
        </div>
      </section>

      {/* ============== CATALOGUE — DARK SLAB ============== */}
      <section
        style={{
          background: theme.colors.ink,
          color: theme.colors.bg,
          padding: '120px 32px',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 64,
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <h2
              style={{
                fontFamily: fontDisplay,
                fontWeight: 800,
                fontSize: 'clamp(36px, 5.6vw, 72px)',
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              <span style={{ color: accent }}>{`>`}</span> Le drop
            </h2>
            <p
              style={{
                fontFamily: fontDisplay,
                fontSize: 11,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.65)',
                margin: 0,
              }}
            >
              {products.length} item{products.length > 1 ? 's' : ''} · live
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
            }}
          >
            {products.map((product, idx) => {
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
                    border: `1.5px solid rgba(255,255,255,0.18)`,
                    padding: 16,
                    color: 'inherit',
                    textDecoration: 'none',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      background: 'rgba(255,255,255,0.05)',
                      marginBottom: 16,
                      overflow: 'hidden',
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
                      fontFamily: fontDisplay,
                      fontSize: 10,
                      letterSpacing: '0.24em',
                      textTransform: 'uppercase',
                      color: accent,
                      margin: '0 0 8px',
                      fontWeight: 700,
                    }}
                  >
                    [ITEM_{String(idx + 1).padStart(2, '0')}]
                  </p>
                  <h3
                    style={{
                      fontFamily: fontDisplay,
                      fontWeight: 700,
                      fontSize: 18,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      margin: '0 0 8px',
                      lineHeight: 1.3,
                    }}
                  >
                    {product.title}
                  </h3>
                  {formattedPrice && (
                    <p
                      style={{
                        fontFamily: fontDisplay,
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.75)',
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

          {firstProduct?.variants?.[0] && (
            <div style={{ marginTop: 64, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              <AddToCartButton
                variantId={firstProduct.variants[0].id}
                storeSlug={store.slug}
              />
            </div>
          )}
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer
        style={{
          padding: '32px',
          fontFamily: fontDisplay,
          fontSize: 10,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: theme.colors.muted,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 16,
          borderTop: `1px solid ${theme.colors.line}`,
        }}
      >
        <span>Accessibility Statement</span>
        <span>Terms & Conditions</span>
        <span>Privacy Policy</span>
        <span>© {new Date().getFullYear()} {store.name}</span>
      </footer>
    </div>
  );
}

function formatNowAsEventDate(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ord = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${months[d.getMonth()]} ${ord(d.getDate())} ${d.getFullYear()}`;
}

function formatTodayWeekday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

export default EventsArcadiumLanding;
