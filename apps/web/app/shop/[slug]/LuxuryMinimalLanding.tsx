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

export interface LuxuryProduct {
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
  products: LuxuryProduct[];
}

/**
 * Luxury minimal storefront — black & white, typo-driven, lots of breathing
 * room. Inspired by Maison Margiela / Aesop / Bottega's website grammar.
 *
 * Decisive choices:
 *   - No color whatsoever (store.primaryColor is ignored on purpose).
 *   - Hero is one centered word + serif-weight Satoshi at 900 + huge negative
 *     tracking. The store name *is* the hero.
 *   - Catalog is a 2-up grid with editorial captions, no badges, no price
 *     bling — price sits below in 12px tabular.
 *   - Full-bleed image moments interleave the products, like a magazine
 *     spread.
 *   - One product → still works (renders as a single editorial product
 *     page), but the operator can pick `mono` for the long-form version.
 */
export function LuxuryMinimalLanding({ store, products }: Props) {
  const heroImage = store.heroImageUrl || products[0]?.thumbnail || products[0]?.images?.[0]?.url;
  const splitImage = store.lifestyleImages[0] ?? null;
  const closingImage = store.lifestyleImages[1] ?? store.cutoutImageUrl ?? null;

  return (
    <div className="bg-white text-zinc-950">
      {/* ============== HERO — pure type ============== */}
      <section className="relative min-h-[78svh] flex items-center justify-center px-6 sm:px-10">
        <div className="text-center max-w-5xl">
          <p className="text-[10px] uppercase tracking-[0.32em] text-zinc-500 mb-10 font-medium">
            {store.niche}
          </p>
          <h1 className="font-black tracking-[-0.06em] leading-[0.86] text-[clamp(4rem,16vw,12rem)]">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="mt-12 max-w-xl mx-auto text-base sm:text-lg text-zinc-600 leading-relaxed">
              {store.tagline}
            </p>
          )}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-400">
          <span className="text-[10px] uppercase tracking-[0.32em]">Scroll</span>
          <span className="h-10 w-px bg-zinc-300" aria-hidden />
        </div>
      </section>

      {/* ============== FULL-BLEED IMAGE 1 ============== */}
      {heroImage && (
        <section className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={store.name}
            className="w-full h-[88vh] object-cover grayscale-[20%]"
          />
        </section>
      )}

      {/* ============== STATEMENT ============== */}
      <section className="px-6 sm:px-10 py-32 sm:py-44 max-w-3xl mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.32em] text-zinc-500 mb-8 font-medium">
          La maison
        </p>
        <p className="text-2xl sm:text-3xl leading-[1.4] tracking-[-0.01em] text-zinc-800">
          {store.description ||
            `Une sélection ${store.niche.toLowerCase()} — assemblée pièce par pièce, sans compromis.`}
        </p>
      </section>

      {/* ============== CATALOG — 2up grid ============== */}
      <section className="px-6 sm:px-10 pb-20 max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-16">
          <h2 className="font-black tracking-[-0.04em] text-3xl sm:text-4xl">Le catalogue</h2>
          <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 font-medium">
            {products.length} pièce{products.length > 1 ? 's' : ''}
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-20">
          {products.map((product, idx) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const currency = variant?.calculated_price?.currency_code || 'eur';
            const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
            const image = product.thumbnail || product.images?.[0]?.url;
            return (
              <li key={product.id} className="group">
                <Link href={`/shop/${store.slug}/products/${product.handle}`} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 mb-6">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-300 text-6xl">
                        ◇
                      </div>
                    )}
                    <span
                      className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.32em] text-white mix-blend-difference font-medium tabular-nums"
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg sm:text-xl font-bold tracking-[-0.015em] flex-1">
                      {product.title}
                    </h3>
                    {formattedPrice && (
                      <p className="text-sm tabular-nums text-zinc-500 shrink-0">{formattedPrice}</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ============== FULL-BLEED IMAGE 2 ============== */}
      {splitImage && (
        <section className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={splitImage}
            alt=""
            className="w-full h-[78vh] object-cover grayscale-[30%]"
          />
        </section>
      )}

      {/* ============== CLOSING / CTA ============== */}
      <section className="px-6 sm:px-10 py-32 sm:py-44 max-w-4xl mx-auto text-center">
        <h2 className="font-black tracking-[-0.05em] leading-[0.92] text-[clamp(2.5rem,8vw,6rem)]">
          {store.tagline ? store.tagline.split(' ').slice(0, 4).join(' ') : 'Une intention par pièce.'}
        </h2>
        {products[0]?.variants?.[0] && (
          <div className="mt-14 max-w-xs mx-auto">
            <AddToCartButton variantId={products[0].variants[0].id} storeSlug={store.slug} />
          </div>
        )}
      </section>

      {/* ============== FOOTER MOMENT ============== */}
      {closingImage && (
        <section className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={closingImage}
            alt=""
            className="w-full h-[64vh] object-cover grayscale-[40%]"
          />
        </section>
      )}
    </div>
  );
}
