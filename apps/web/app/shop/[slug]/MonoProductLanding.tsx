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
  GestureIcon,
} from '@/components/ui';
import { ProductShowcase } from '@/components/ui/ProductShowcase';

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: { calculated_amount: number; original_amount?: number; currency_code: string } | null;
}

export interface MonoProductLandingProduct {
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
  product: MonoProductLandingProduct;
}

/**
 * Long-form mono-product landing page, built exclusively from the
 * `components/ui` primitives. Layout (per founder's explicit plan):
 *
 *   1. Hero (parallax bg, italic-accented H1, single bare CTA — no qty stepper)
 *   2. Trois raisons (numbered USPs)
 *   3. Showcase (dark stage with the headline integrated INSIDE the frame —
 *      no SectionHeader above to avoid the"empty stage" feeling)
 *   4. Beach moment (single full-bleed Kontext + parallax)
 *   5. Specs (10-row table)
 *   6. Trois gestes (process, with custom monoline icons)
 *   7. Inclus dans le pack (4 cards)
 *   8. Final CTA (gradient stage, single bare CTA — no qty stepper)
 *
 * Decisive cuts vs the previous draft (founder feedback): no press marquee,
 * no social-proof stats, no pullquote, no lifestyle gallery, no
 * testimonials, no comparison table, no FAQ. The page is the story; the
 * cart page is where qty/details get nailed down.
 */
export function MonoProductLanding({ store, product }: Props) {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
  const compareAtPrice = price !== undefined ? formatMoney(price * 1.6, currency) : null;

  // Auto-generated assets live in DB (mono mode: hero/cutout/lifestyles/promo
  // video populated by lib/agent/asset-generator.ts). Legacy brisa-style
  // file-based assets still resolve via /generated/{slug}/current/* — the
  // store-creator's symlink keeps that path live.
  const heroImage = store.heroImageUrl || product.thumbnail || product.images?.[0]?.url;
  const cutoutImage = store.cutoutImageUrl;
  // First lifestyle wins the parallax beach slot. We intentionally pick by
  // index (not by name) so the agent stays agnostic about scene labels.
  const beachImage = store.lifestyleImages[0] ?? null;

  return (
    <>
      {/* ================== HERO ================== */}
      <HeroSection
        store={store}
        product={product}
        heroImage={heroImage}
        formattedPrice={formattedPrice}
        compareAtPrice={compareAtPrice}
        variant={variant}
      />

      {/* ================== TROIS RAISONS ==================
         Built from the agent-generated structured selling points if
         available, otherwise from the product description split into
         three semantic chunks. NEVER hardcode product-specific copy
         here. */}
      <Section tone="light" padding="lg">
        <SectionHeader
          kicker="Conception"
          title={<>Pourquoi <em className="text-zinc-500">{product.title.split(' ').slice(0, 2).join(' ').toLowerCase()}</em>.</>}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 mt-14 border border-zinc-200 rounded-2xl overflow-hidden">
          {deriveSellingPoints(product, store).map((u) => (
            <div
              key={u.num}
              className="bg-white p-10 transition-[background-color,transform] duration-300 hover:bg-zinc-50/60 hover:-translate-y-0.5"
            >
              <NumberMark value={u.num} color={store.primaryColor} size="lg" />
              <Heading as="h3" level="h4" className="mt-6 mb-3">
                {u.title}
              </Heading>
              <p className="text-sm text-zinc-600 leading-relaxed">{u.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================== PRODUCT SHOWCASE ==================
         Headline lives INSIDE the dark frame to avoid an empty stage. No
         SectionHeader above. */}
      {cutoutImage && (
        <Section tone="dark" padding="xl">
          <div className="max-w-[1400px] mx-auto">
            <ProductShowcase
              imageUrl={cutoutImage}
              alt={product.title}
              primaryColor={store.primaryColor}
              accentColor={store.accentColor}
              kicker="L’objet"
              headline={
                <>
                  {product.title.split(' ').slice(0, 2).join(' ')},<br />
                  <em className="text-white/75">pensé pour vous</em>.
                </>
              }
              lede={
                product.description?.slice(0, 200) ||
                store.description ||
                `${product.title} — conçu pour répondre à un usage précis, fini avec soin.`
              }
              aspect="16/10"
            />
          </div>
        </Section>
      )}

      {/* ================== BEACH MOMENT (parallax full-bleed) ==================
         Promo video wins over the static lifestyle when available — auto-
         play muted loop, no controls, treated as decorative motion. Falls
         back to the first lifestyle image. */}
      {(store.promoVideoUrl || beachImage) && (
        <section className="relative overflow-hidden h-[70vh] sm:h-[88vh] bg-zinc-950">
          <Parallax speed={-0.18} className="absolute inset-0 -top-[8%] -bottom-[8%]">
            {store.promoVideoUrl ? (
              <video
                src={store.promoVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover [filter:saturate(1.06)_contrast(1.04)]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beachImage!}
                alt=""
                className="w-full h-full object-cover [filter:saturate(1.06)_contrast(1.04)]"
              />
            )}
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/30" />
          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-12 sm:pb-20 w-full">
              <Parallax speed={0.12} className="max-w-3xl">
                <Kicker tone="inverse">En situation</Kicker>
                <Heading level="h1" className="text-white mt-4">
                  {store.tagline || product.title}
                </Heading>
              </Parallax>
            </div>
          </div>
        </section>
      )}

      {/* ================== DESCRIPTION DÉTAILLÉE ==================
         Use the enriched product description as a long-form block.
         Generic specs were product-specific (ventilator measurements)
         and have been removed; future stores can carry structured
         specs in `product.specs jsonb`. */}
      {product.description && (
        <Section tone="light" width="default" padding="lg">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              kicker="En détail"
              title={<>Ce qu&apos;il faut <em className="text-zinc-500">savoir</em>.</>}
            />
            <div className="mt-12 text-base text-zinc-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        </Section>
      )}

      {/* ================== TROIS PROMESSES ==================
         Generic post-purchase reassurance — works for any product.
         Used to be product-specific gestures (ventilator) which broke
         the moment the template was used for anything else. */}
      <Section tone="dark" padding="lg">
        <SectionHeader
          kicker="Notre promesse"
          title={<>Quand vous <em className="text-white/60">commandez</em>.</>}
          tone="inverse"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mt-16">
          {[
            {
              num: '01',
              icon: 'charge' as const,
              title: 'Expédition 24h',
              body: 'Commande validée avant 16h, votre colis part le jour même depuis notre entrepôt. Suivi temps réel par email dès le départ.',
            },
            {
              num: '02',
              icon: 'wear' as const,
              title: 'Livraison soignée',
              body: 'Emballage protégé, transporteurs partenaires en France métropolitaine. Réception sous 3 à 7 jours ouvrés, à la maison ou en point relais.',
            },
            {
              num: '03',
              icon: 'blow' as const,
              title: 'Essai 30 jours',
              body: 'Vous testez chez vous pendant un mois entier. Si le produit ne vous convient pas, on le reprend et on vous rembourse sans question.',
            },
          ].map((s) => (
            <div key={s.num} className="group relative pl-6 border-l border-white/15 transition-colors hover:border-white/30">
              <div
                className="absolute -left-px top-0 h-10 w-px bg-white/80 origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-500 ease-out"
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-4">
                <NumberMark value={s.num} color={store.accentColor} size="xl" />
                <div className="text-white/40 group-hover:text-white/85 transition-colors">
                  <GestureIcon name={s.icon} size={56} />
                </div>
              </div>
              <Heading as="h3" level="h4" className="mt-6 mb-3 text-white">
                {s.title}
              </Heading>
              <p className="text-sm text-white/70 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================== INCLUS ================== */}
      <Section tone="light" padding="lg">
        <div className="max-w-5xl mx-auto">
          <SectionHeader kicker="Livraison" title="Inclus dans votre commande." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {[
              { qty: '01', label: product.title },
              { qty: '·', label: 'Emballage protégé' },
              { qty: '·', label: 'Notice d’utilisation' },
              { qty: '·', label: 'Suivi de livraison' },
            ].map((i) => (
              <div
                key={i.label}
                className="border border-zinc-200 rounded-xl p-6 text-center transition-[border-color,transform,box-shadow] duration-300 hover:border-zinc-300 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <NumberMark value={i.qty} color={store.primaryColor} size="md" />
                <div className="mt-3 text-sm text-zinc-700 leading-snug line-clamp-2">{i.label}</div>
              </div>
            ))}
          </div>
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
          <Kicker tone="inverse">Prêt&nbsp;?</Kicker>
          <Heading level="h1" className="text-white mt-5">
            {store.tagline || product.title}
          </Heading>
          <div className="mt-6">
            <Lede tone="inverse" className="max-w-xl mx-auto">
              {store.description ||
                `Commandez aujourd'hui, livraison sous 3 à 7 jours en France. 30 jours pour l'essayer chez vous, remboursé si vous changez d'avis.`}
            </Lede>
          </div>
          {variant && (
            <div className="mt-12 mx-auto w-full max-w-xs">
              <AddToCartButton variantId={variant.id} storeSlug={store.slug} tone="light" />
            </div>
          )}
          {formattedPrice && (
            <p className="mt-8 text-sm text-white/85">
              <span className="font-semibold tracking-tight text-3xl mr-2">{formattedPrice}</span>
              {compareAtPrice && (
                <span className="line-through text-white/50 mr-2">{compareAtPrice}</span>
              )}
              <span className="opacity-80">· livraison incluse en France</span>
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Build three generic selling points from whatever copy we have for the
 * product. Splits the description into sentences and uses the first three
 * as the body of each card; falls back to a generic trust strip when the
 * description is too short.
 *
 * Replaces a previous hardcoded Brisa-ventilator block that leaked into
 * every other niche using the mono template.
 */
function deriveSellingPoints(
  product: MonoProductLandingProduct,
  store: StoreConfig,
): Array<{ num: string; title: string; body: string }> {
  const desc = (product.description || store.description || '').trim();
  const sentences = desc
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 280);

  if (sentences.length >= 3) {
    const titles = [
      headlineFrom(sentences[0]!),
      headlineFrom(sentences[1]!),
      headlineFrom(sentences[2]!),
    ];
    return [
      { num: '01', title: titles[0], body: sentences[0]! },
      { num: '02', title: titles[1], body: sentences[1]! },
      { num: '03', title: titles[2], body: sentences[2]! },
    ];
  }

  // Generic trust fallback — works for any niche, never reads as wrong.
  return [
    {
      num: '01',
      title: 'Sélection minutieuse',
      body: 'Chaque pièce est validée par notre équipe avant publication. On garde ce qui tient, on retire ce qui déçoit.',
    },
    {
      num: '02',
      title: 'Livraison soignée',
      body: 'Expédition rapide en France métropolitaine, suivi temps réel par email, emballage protégé.',
    },
    {
      num: '03',
      title: 'Satisfait ou remboursé',
      body: '30 jours pour essayer chez vous. Si ça ne vous convient pas, on reprend et on rembourse sans question.',
    },
  ];
}

/**
 * Make a short headline (2-5 words) from the first noun phrase of a sentence.
 * Cheap heuristic: take the first 4 meaningful words, capitalize the first.
 */
function headlineFrom(sentence: string): string {
  const words = sentence
    .replace(/^[^a-zA-ZÀ-ÿ]+/, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);
  if (words.length === 0) return 'Pensé pour durer';
  const head = words.join(' ');
  return head.charAt(0).toUpperCase() + head.slice(1);
}

/* ================== Hero (split out for readability) ================== */

function HeroSection({
  store,
  product,
  heroImage,
  formattedPrice,
  compareAtPrice,
  variant,
}: {
  store: StoreConfig;
  product: MonoProductLandingProduct;
  heroImage: string | null | undefined;
  formattedPrice: string | null;
  compareAtPrice: string | null;
  variant: MedusaVariant | undefined;
}) {
  // Heuristic italic accent: take the last word of the tagline and italicise it.
  const tagline = store.tagline || 'La fraîcheur, où que vous alliez.';
  const lastSpace = tagline.lastIndexOf(' ');
  const taglineHead = lastSpace > 0 ? tagline.slice(0, lastSpace) : tagline;
  const taglineTail = lastSpace > 0 ? tagline.slice(lastSpace + 1).replace(/[.!?]$/, '') : '';
  const trailingPunct = lastSpace > 0 ? tagline.slice(-1).match(/[.!?]/)?.[0] || '' : '';

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-zinc-950">
      {heroImage && (
        <Parallax speed={-0.22} className="absolute inset-0 -top-[6%] -bottom-[6%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={product.title}
            className="brisa-hero-img w-full h-full object-cover object-[70%_center]"
          />
        </Parallax>
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${store.primaryColor} 0%, ${store.primaryColor}EE 25%, ${store.primaryColor}99 45%, transparent 65%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-32 pb-20 min-h-[100svh] flex items-center">
        <Parallax speed={0.08} className="max-w-xl text-white">
          <div className="brisa-fade-1 inline-flex items-center gap-3 mb-8">
            <span className="h-px w-10 bg-white/60" aria-hidden="true" />
            <span className="text-kicker uppercase tracking-kicker font-medium">
              {store.niche ? `${store.niche}` : 'Nouveau'} · {new Date().getFullYear()}
            </span>
          </div>

          <div className="brisa-fade-1">
            <Heading level="h1" className="text-white">
              {taglineHead}
              {taglineTail && (
                <>
                  {' '}
                  <em className="text-white/85">
                    {taglineTail}
                  </em>
                  {trailingPunct}
                </>
              )}
            </Heading>
          </div>

          <div className="brisa-fade-2 mt-8 max-w-md">
            <Lede tone="inverse">
              {store.description ||
                product.description?.slice(0, 220) ||
                product.title}
            </Lede>
          </div>

          {formattedPrice && (
            <div className="brisa-fade-3 flex items-baseline gap-4 mt-10">
              <span className="font-semibold tracking-tight text-5xl lg:text-6xl">{formattedPrice}</span>
              {compareAtPrice && (
                <span className="text-xl text-white/50 line-through">{compareAtPrice}</span>
              )}
              <span className="text-kicker uppercase tracking-wider bg-white text-zinc-900 px-2.5 py-1 rounded-full font-bold">
                -38%
              </span>
            </div>
          )}

          {variant && (
            <div className="brisa-fade-3 mt-8 max-w-xs">
              <AddToCartButton variantId={variant.id} storeSlug={store.slug} tone="light" />
            </div>
          )}

          <div className="brisa-fade-4 flex flex-wrap items-center gap-x-6 gap-y-3 mt-10">
            <TrustItem label="Expédition sous 24h" tone="inverse" />
            <TrustItem label="Paiement sécurisé Stripe" tone="inverse" />
            <TrustItem label="Retour 30 jours" tone="inverse" />
          </div>
        </Parallax>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-kicker uppercase tracking-kicker flex flex-col items-center gap-2">
        <span>Découvrir</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
          <path d="M7 0v18m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    </section>
  );
}
