import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import { formatMoney } from '@/lib/medusa-store';
import type { StoreConfig } from '@/lib/store-config';
import {
  Section,
  SectionHeader,
  Heading,
  Lede,
  Kicker,
  NumberMark,
  TrustItem,
  Parallax,
  StoreLogo,
} from '@/components/ui';

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: { calculated_amount: number; original_amount?: number; currency_code: string } | null;
}

export interface EditorialProduct {
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
  products: EditorialProduct[];
}

/**
 * Editorial collection landing — third storefront template (P1.4).
 *
 * Stands between MonoProductLanding (1 SKU, long form) and the bare grid
 * (4 columns of cards). Optimised for 3-6 products tied by a narrative —
 * lifestyle / craft / premium niches where each product is a"moment"
 * rather than an interchangeable SKU.
 *
 * Layout: hero → intro (store description) → alternating product
 * sections numbered 01..N (image left / text right, then swapped) →
 * trust strip → branded CTA close.
 *
 * Built exclusively from the shared `components/ui` primitives so the
 * type rhythm matches Mono and the storefront chrome.
 */
export function CollectionEditorialLanding({ store, products }: Props) {
  const displayProducts = products.slice(0, 6);
  const taglineWithAccent = splitTagline(store.tagline || 'La sélection.');
  const heroImage = store.heroImageUrl || displayProducts[0]?.thumbnail || displayProducts[0]?.images?.[0]?.url;
  const lifestylePool = store.lifestyleImages;

  return (
    <>
      {/* ================== HERO ================== */}
      <section className="relative min-h-[80svh] overflow-hidden bg-zinc-950">
        {heroImage && (
          <Parallax speed={-0.18} className="absolute inset-0 -top-[6%] -bottom-[6%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={store.name}
              className="brisa-hero-img w-full h-full object-cover object-center"
            />
          </Parallax>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${store.primaryColor}55 0%, ${store.primaryColor}AA 60%, ${store.primaryColor}DD 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20 min-h-[80svh] flex items-end">
          <Parallax speed={0.08} className="max-w-2xl text-white">
            <div className="brisa-fade-1 inline-flex items-center gap-3 mb-8">
              <span className="h-px w-10 bg-white/60" aria-hidden="true" />
              <span className="text-kicker uppercase tracking-kicker font-medium">
                {store.niche} · {displayProducts.length} pièces
              </span>
            </div>

            <div className="brisa-fade-1">
              <Heading level="h1" className="text-white">
                {taglineWithAccent.head}
                {taglineWithAccent.tail && (
                  <>
                    {' '}
                    <em className="text-white/85">{taglineWithAccent.tail}</em>
                    {taglineWithAccent.trailing}
                  </>
                )}
              </Heading>
            </div>

            {store.description && (
              <div className="brisa-fade-2 mt-8 max-w-xl">
                <Lede tone="inverse">{store.description}</Lede>
              </div>
            )}
          </Parallax>
        </div>
      </section>

      {/* ================== INTRO ================== */}
      <Section tone="light" padding="lg">
        <div className="max-w-3xl mx-auto text-center">
          <SectionHeader
            kicker="La sélection"
            title={
              <>
                {displayProducts.length} pièce{displayProducts.length > 1 ? 's' : ''},{' '}
                <em className="text-zinc-500">une intention</em>.
              </>
            }
            lede={store.description || undefined}
          />
        </div>
      </Section>

      {/* ================== PRODUCTS — alternating ================== */}
      <Section tone="light" padding="lg">
        <div className="max-w-6xl mx-auto space-y-24 sm:space-y-32">
          {displayProducts.map((product, idx) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price?.calculated_amount;
            const currency = variant?.calculated_price?.currency_code || 'eur';
            const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
            // Prefer a lifestyle photo for visual variety; fall back to the
            // raw product image so the layout never breaks.
            const lifestyle = lifestylePool[idx % Math.max(lifestylePool.length, 1)];
            const productImage = product.thumbnail || product.images?.[0]?.url;
            const image = lifestyle || productImage;
            const num = String(idx + 1).padStart(2, '0');
            const flipped = idx % 2 === 1;

            return (
              <article
                key={product.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-10 sm:gap-14 items-center"
              >
                <div className={`md:col-span-7 ${flipped ? 'md:order-2' : ''}`}>
                  {image ? (
                    <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={product.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[5/4] rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                      <StoreLogo emoji={store.logoEmoji} size={64} strokeWidth={1.25} />
                    </div>
                  )}
                </div>

                <div className={`md:col-span-5 ${flipped ? 'md:order-1' : ''}`}>
                  <NumberMark value={num} color={store.primaryColor} size="lg" />
                  <Heading as="h2" level="h3" className="mt-5">
                    {product.title}
                  </Heading>
                  {product.description && (
                    <p className="mt-5 text-base text-zinc-600 leading-relaxed line-clamp-6">
                      {product.description}
                    </p>
                  )}
                  {formattedPrice && (
                    <div className="mt-6 font-semibold tracking-tight text-3xl text-zinc-900">{formattedPrice}</div>
                  )}
                  {variant && (
                    <div className="mt-6 max-w-xs">
                      <AddToCartButton variantId={variant.id} storeSlug={store.slug} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* ================== TRUST STRIP ================== */}
      <Section tone="light" padding="md">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <TrustItem label="Expédition sous 24h" />
          <TrustItem label="Paiement sécurisé Stripe" />
          <TrustItem label="Retour 30 jours" />
        </div>
      </Section>

      {/* ================== FINAL CTA ================== */}
      <section
        className="relative overflow-hidden py-24 sm:py-32"
        style={{
          background: `linear-gradient(135deg, ${store.primaryColor} 0%, ${store.accentColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 text-center text-white">
          <Kicker tone="inverse">Choisir une pièce</Kicker>
          <Heading level="h1" className="text-white mt-5">
            {store.tagline || (
              <>
                La <em className="">collection</em> vous attend.
              </>
            )}
          </Heading>
          <div className="mt-6">
            <Lede tone="inverse" className="max-w-xl mx-auto">
              {store.description ||
                'Livraison soignée en France métropolitaine. 30 jours pour essayer chez vous. Si une pièce ne vous plaît pas, on la reprend.'}
            </Lede>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Pull the last word of the tagline out as an italic accent. Same trick as
 * MonoProductLanding's hero — keeps the typographic rhythm consistent
 * across templates.
 */
function splitTagline(tagline: string): { head: string; tail: string; trailing: string } {
  const lastSpace = tagline.lastIndexOf(' ');
  if (lastSpace <= 0) return { head: tagline, tail: '', trailing: '' };
  const head = tagline.slice(0, lastSpace);
  const rawTail = tagline.slice(lastSpace + 1);
  const trailingMatch = rawTail.match(/[.!?]$/);
  const trailing = trailingMatch?.[0] ?? '';
  const tail = trailing ? rawTail.slice(0, -1) : rawTail;
  return { head, tail, trailing };
}
