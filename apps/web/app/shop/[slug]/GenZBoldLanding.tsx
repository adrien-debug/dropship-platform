import Link from 'next/link';
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

export interface GenZProduct {
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
  products: GenZProduct[];
}

/**
 * Gen-Z bold storefront — saturated brand color full-bleed, oversized type,
 * grain texture, blunt copy. Reads loud on purpose; the brand color earns
 * its keep as the dominant visual element rather than being relegated to
 * an accent.
 *
 * Decisive choices:
 *   - Hero is a full-screen wash of store.primaryColor with the tagline
 *     in cream-white Satoshi black, oversized, slightly rotated.
 *   - Products live in pill-shaped cards on the colored background, two
 *     up on desktop, stacked on mobile.
 *   - Marquee strip with the store's niche keywords scrolling forever.
 *   - Closing CTA is a single huge button. No tabs, no accordion, no FAQ.
 *
 * The CSS grain is generated inline via an SVG turbulence filter so we
 * don't need a network asset.
 */
export function GenZBoldLanding({ store, products }: Props) {
  const primary = store.primaryColor || '#ff4f3a';
  const accent = store.accentColor || '#fffacb';
  const heroImage = store.heroImageUrl || products[0]?.thumbnail || products[0]?.images?.[0]?.url;
  const niche = store.niche || 'drop';

  // Marquee text — repeat the niche + 3 stock attitudes
  const marquee = [niche, 'no filler', 'no apologies', niche, 'made loud', 'made now', niche, 'limited'];

  return (
    <div className="relative" style={{ backgroundColor: primary, color: accent }}>
      {/* SVG grain overlay — sits above everything */}
      <svg
        className="pointer-events-none fixed inset-0 w-full h-full opacity-[0.12] mix-blend-overlay z-[1]"
        aria-hidden
      >
        <filter id="genz-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#genz-grain)" />
      </svg>

      <div className="relative z-[2]">
        {/* ============== HERO ============== */}
        <section className="min-h-[92svh] flex flex-col items-start justify-end px-6 sm:px-10 pt-32 pb-16 relative overflow-hidden">
          {/* Big rotating word in the back */}
          <p
            className="absolute right-[-2%] top-[8%] font-black uppercase tracking-[-0.06em] leading-[0.8] opacity-[0.18] select-none pointer-events-none whitespace-nowrap"
            style={{
              fontSize: 'clamp(8rem, 22vw, 22rem)',
              transform: 'rotate(-4deg)',
            }}
            aria-hidden
          >
            {niche}
          </p>

          <p
            className="text-[10px] uppercase tracking-[0.32em] font-semibold mb-6"
            style={{ color: accent }}
          >
            Drop · {new Date().getFullYear()}
          </p>
          <h1
            className="font-black tracking-[-0.05em] leading-[0.9] max-w-4xl"
            style={{ fontSize: 'clamp(3.5rem, 11vw, 8rem)' }}
          >
            {store.tagline || `${store.name}. No filler.`}
          </h1>
          {store.description && (
            <p className="mt-8 max-w-xl text-lg sm:text-xl leading-snug opacity-90 font-medium">
              {store.description}
            </p>
          )}
          {products[0]?.variants?.[0] && (
            <Link
              href={`/shop/${store.slug}/products/${products[0]!.handle}`}
              className="mt-10 inline-flex items-center gap-3 bg-black text-white font-bold uppercase tracking-[0.16em] text-sm px-7 py-4 rounded-full hover:bg-zinc-900 transition-transform hover:scale-[1.03] active:scale-100"
            >
              Shop the drop
              <span aria-hidden className="text-base leading-none">→</span>
            </Link>
          )}
        </section>

        {/* ============== MARQUEE ============== */}
        <div
          className="border-y overflow-hidden py-4"
          style={{ borderColor: `${accent}44` }}
        >
          <div className="flex gap-12 animate-[marquee_30s_linear_infinite] whitespace-nowrap font-black tracking-[-0.02em] text-3xl sm:text-4xl uppercase">
            {[...marquee, ...marquee, ...marquee].map((w, i) => (
              <span key={i} className="flex items-center gap-12">
                {w}
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: accent, opacity: 0.6 }} />
              </span>
            ))}
          </div>
        </div>

        {/* ============== HERO IMAGE FRAMED ============== */}
        {heroImage && (
          <section className="px-6 sm:px-10 py-16">
            <div
              className="relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden border-4"
              style={{ borderColor: accent }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={store.name}
                className="w-full aspect-[16/10] object-cover [filter:saturate(1.15)_contrast(1.05)]"
              />
              <span
                className="absolute top-5 left-5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.18em]"
                style={{ backgroundColor: accent, color: primary }}
              >
                Hot ·· {niche}
              </span>
            </div>
          </section>
        )}

        {/* ============== PRODUCTS GRID ============== */}
        <section className="px-6 sm:px-10 py-20 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <h2
              className="font-black tracking-[-0.04em] leading-none"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
            >
              The drop.
            </h2>
            <p className="text-[11px] uppercase tracking-[0.28em] font-semibold opacity-80">
              {products.length} piece{products.length > 1 ? 's' : ''}
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {products.map((product, idx) => {
              const variant = product.variants?.[0];
              const price = variant?.calculated_price?.calculated_amount;
              const currency = variant?.calculated_price?.currency_code || 'eur';
              const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
              const image = product.thumbnail || product.images?.[0]?.url;
              const flipped = idx % 4 === 1 || idx % 4 === 2;
              return (
                <li
                  key={product.id}
                  className="relative rounded-[2rem] overflow-hidden p-5 sm:p-7 group transition-transform duration-300 hover:-rotate-1"
                  style={{
                    backgroundColor: flipped ? accent : '#000',
                    color: flipped ? primary : accent,
                  }}
                >
                  <Link href={`/shop/${store.slug}/products/${product.handle}`} className="block">
                    <span className="text-[10px] uppercase tracking-[0.32em] font-bold tabular-nums">
                      № {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="aspect-square rounded-2xl overflow-hidden bg-black/10 my-5">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={product.title}
                          className="w-full h-full object-cover [filter:saturate(1.1)] transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl opacity-50">
                          ✶
                        </div>
                      )}
                    </div>
                    <h3
                      className="font-black tracking-[-0.03em] leading-[0.95]"
                      style={{ fontSize: 'clamp(1.5rem, 2.4vw, 2.25rem)' }}
                    >
                      {product.title}
                    </h3>
                    {formattedPrice && (
                      <p className="mt-4 font-bold tabular-nums text-2xl">{formattedPrice}</p>
                    )}
                  </Link>
                  {variant && (
                    <div className="mt-5">
                      <AddToCartButton variantId={variant.id} storeSlug={store.slug} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ============== CLOSING CTA ============== */}
        <section className="px-6 sm:px-10 py-32 text-center max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.32em] font-semibold opacity-70 mb-6">
            Last call
          </p>
          <h2
            className="font-black tracking-[-0.05em] leading-[0.9]"
            style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}
          >
            Don&apos;t<br />sleep on it.
          </h2>
          {products[0]?.variants?.[0] && (
            <Link
              href={`/shop/${store.slug}/products/${products[0]!.handle}`}
              className="mt-10 inline-flex items-center gap-3 bg-black text-white font-bold uppercase tracking-[0.16em] text-sm px-9 py-5 rounded-full hover:bg-zinc-900 transition-transform hover:scale-[1.03]"
            >
              Cop now
              <span aria-hidden>→</span>
            </Link>
          )}
        </section>
      </div>

      {/* Local keyframes for the marquee — kept inline so the template
          stays portable and doesn't pollute the global stylesheet. */}
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[marquee_30s_linear_infinite\\] { animation: none; }
        }
      `}</style>
    </div>
  );
}
