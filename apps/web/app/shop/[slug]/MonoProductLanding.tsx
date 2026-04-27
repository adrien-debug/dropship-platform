import { existsSync } from 'fs';
import path from 'path';
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
 *      no SectionHeader above to avoid the "empty stage" feeling)
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

  const heroOverride = (() => {
    const dir = path.join(process.cwd(), 'public', 'generated', store.slug, 'current');
    for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
      if (existsSync(path.join(dir, `hero.${ext}`))) {
        return `/generated/${store.slug}/current/hero.${ext}`;
      }
    }
    return null;
  })();
  const heroImage = heroOverride || product.thumbnail || product.images?.[0]?.url;

  // Curated single-image lifestyle shot. Right now hardcoded to the only Kontext
  // render that holds up; later this becomes a per-store curated list in DB.
  const beachImage =
    store.slug === 'brisa-mohlwwe7'
      ? '/generated/brisa-mohlwwe7/run-2026-04-28-0006-flux-kontext-real-product/beach_terrace.png'
      : null;

  const cutoutImage = (() => {
    const dir = path.join(process.cwd(), 'public', 'generated', store.slug, 'current');
    for (const ext of ['png', 'webp']) {
      if (existsSync(path.join(dir, `product-cutout.${ext}`))) {
        return `/generated/${store.slug}/current/product-cutout.${ext}`;
      }
    }
    return null;
  })();

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

      {/* ================== TROIS RAISONS ================== */}
      <Section tone="light" padding="lg">
        <SectionHeader kicker="Conception" title={<>Pourquoi on l’a fait <em className="font-serif italic text-zinc-500">comme ça</em>.</>} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 mt-14 border border-zinc-200 rounded-2xl overflow-hidden">
          {[
            {
              num: '01',
              title: 'Aucune pale qui tourne',
              body:
                'À la place des pales classiques, des micro-perforations sur le côté du collier. Vos cheveux ne risquent rien, vos doigts non plus. Plus besoin de faire attention.',
            },
            {
              num: '02',
              title: 'Une journée entière',
              body:
                'Batterie 4 000 mAh, qui tient huit heures à petite vitesse. Recharge complète en deux heures via USB-C. Un écran LED affiche le pourcentage exact, comme sur votre téléphone.',
            },
            {
              num: '03',
              title: '35 décibels, vraiment',
              body:
                'À petite vitesse, on l’entend à peine. Le bruit d’une bibliothèque, posé autour du cou, qui laisse vos deux mains libres pour faire autre chose.',
            },
          ].map((u) => (
            <div
              key={u.num}
              className="bg-white p-10 transition-all duration-300 hover:bg-zinc-50/60 hover:-translate-y-0.5"
            >
              <NumberMark value={u.num} color={store.primaryColor} size="lg" />
              <Heading as="h3" size="sm" className="mt-6 mb-3">
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
                  Un courant d’air,<br />
                  <em className="font-serif italic text-white/75">jamais</em> une rafale.
                </>
              }
              lede="265 grammes posés sur le cou. Pas de pales apparentes, pas de bruit de moteur. On l’oublie au bout d’une minute."
              aspect="16/10"
            />
          </div>
        </Section>
      )}

      {/* ================== BEACH MOMENT (parallax full-bleed) ================== */}
      {beachImage && (
        <section className="relative overflow-hidden h-[70vh] sm:h-[88vh] bg-zinc-950">
          <Parallax speed={-0.18} className="absolute inset-0 -top-[8%] -bottom-[8%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beachImage}
              alt=""
              className="w-full h-full object-cover [filter:saturate(1.06)_contrast(1.04)]"
            />
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/30" />
          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pb-12 sm:pb-20 w-full">
              <Parallax speed={0.12} className="max-w-3xl">
                <Kicker tone="inverse">En vacances</Kicker>
                <Heading size="2xl" className="text-white mt-4">
                  Du bureau à la plage,<br />
                  <em className="font-serif italic">sans transition.</em>
                </Heading>
              </Parallax>
            </div>
          </div>
        </section>
      )}

      {/* ================== SPECS ================== */}
      <Section tone="light" width="default" padding="lg">
        <div className="max-w-5xl mx-auto">
          <SectionHeader kicker="Caractéristiques" title="Ce qu’il y a sous le capot." />
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-px bg-zinc-200 border border-zinc-200 rounded-2xl overflow-hidden">
            {[
              ['Autonomie', 'Jusqu’à 8 heures (vitesse 1)'],
              ['Capacité batterie', '4 000 mAh, lithium-ion'],
              ['Temps de charge', '2 heures via USB-C'],
              ['Niveau sonore', '< 35 dB vitesse 1, < 50 dB vitesse 3'],
              ['Vitesses', '3 niveaux ajustables'],
              ['Poids', '265 g'],
              ['Dimensions', '195 × 175 × 70 mm'],
              ['Connectique', 'USB-C (câble fourni)'],
              ['Garantie', '24 mois constructeur'],
              ['Compatibilité', 'Tour de cou 28 à 48 cm'],
            ].map(([k, v]) => (
              <div key={k} className="bg-white p-5 flex items-baseline justify-between gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500 font-medium">{k}</span>
                <span className="text-sm text-zinc-900 font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ================== TROIS GESTES ================== */}
      <Section tone="dark" padding="lg">
        <SectionHeader
          kicker="Mode d’emploi"
          title={<>Comment on <em className="font-serif italic text-white/60">s’en sert</em>.</>}
          tone="inverse"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mt-16">
          {[
            {
              num: '01',
              icon: 'charge' as const,
              title: 'Charger',
              body: 'Branchez le câble USB-C fourni. La LED clignote pendant la charge, et devient fixe quand la batterie atteint 100 %. Comptez environ deux heures la première fois.',
            },
            {
              num: '02',
              icon: 'wear' as const,
              title: 'Porter',
              body: 'Le collier s’ouvre, se pose autour du cou, et se referme tout seul. Aucun réglage à faire, il s’adapte à toutes les morphologies.',
            },
            {
              num: '03',
              icon: 'blow' as const,
              title: 'Souffler',
              body: 'Un seul bouton. Une pression pour la première vitesse, deux pour la seconde, trois pour le souffle puissant. Une quatrième pour éteindre.',
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
              <Heading as="h3" size="sm" className="mt-6 mb-3 text-white">
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
              { qty: '01', label: 'Ventilateur Brisa' },
              { qty: '01', label: 'Câble USB-C 1 mètre' },
              { qty: '01', label: 'Pochette de transport' },
              { qty: '01', label: 'Manuel d’utilisation FR' },
            ].map((i) => (
              <div
                key={i.label}
                className="border border-zinc-200 rounded-xl p-6 text-center transition-all duration-300 hover:border-zinc-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.25)]"
              >
                <NumberMark value={i.qty} color={store.primaryColor} size="md" />
                <div className="mt-3 text-sm text-zinc-700 leading-snug">{i.label}</div>
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
          <Kicker tone="inverse">Prêt à respirer ?</Kicker>
          <Heading size="2xl" className="text-white mt-5">
            L’été est <em className="font-serif italic">trop court</em><br />pour transpirer.
          </Heading>
          <div className="mt-6">
            <Lede tone="inverse" className="max-w-xl mx-auto">
              Commandez aujourd’hui, recevez votre Brisa sous sept à quinze jours. Trente jours pour l’essayer chez vous. Si ça ne vous plaît pas, on vous rembourse.
            </Lede>
          </div>
          {variant && (
            <div className="mt-12 mx-auto w-full max-w-xs">
              <AddToCartButton variantId={variant.id} storeSlug={store.slug} tone="light" />
            </div>
          )}
          {formattedPrice && (
            <p className="mt-8 text-sm text-white/85">
              <span className="font-serif text-3xl mr-2">{formattedPrice}</span>
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
      <style>{`
        @keyframes brisaSlowZoom {
          0%, 100% { transform: scale(1.04) translateX(0); }
          50%      { transform: scale(1.12) translateX(-1.5%); }
        }
        @keyframes brisaFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .brisa-hero-img { animation: brisaSlowZoom 22s ease-in-out infinite; }
        .brisa-fade-1 { animation: brisaFadeUp 0.9s ease-out 0.1s backwards; }
        .brisa-fade-2 { animation: brisaFadeUp 0.9s ease-out 0.3s backwards; }
        .brisa-fade-3 { animation: brisaFadeUp 0.9s ease-out 0.5s backwards; }
        .brisa-fade-4 { animation: brisaFadeUp 0.9s ease-out 0.7s backwards; }
      `}</style>

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
            <span className="text-[10px] uppercase tracking-[0.3em] font-medium">
              Nouveau · Été 2026
            </span>
          </div>

          <div className="brisa-fade-1">
            <Heading size="hero" className="text-white [letter-spacing:-0.025em]">
              {taglineHead}
              {taglineTail && (
                <>
                  {' '}
                  <em className="font-serif italic text-white/85">
                    {taglineTail}
                  </em>
                  {trailingPunct}
                </>
              )}
            </Heading>
          </div>

          <div className="brisa-fade-2 mt-8 max-w-md">
            <Lede tone="inverse">
              Un ventilateur de cou sans pales, presque inaudible, qui tient toute une journée. Aucun cheveu pris, aucune lame visible. Juste de l&apos;air frais, partout où vous allez.
            </Lede>
          </div>

          {formattedPrice && (
            <div className="brisa-fade-3 flex items-baseline gap-4 mt-10">
              <span className="font-serif text-5xl lg:text-6xl">{formattedPrice}</span>
              {compareAtPrice && (
                <span className="text-xl text-white/50 line-through">{compareAtPrice}</span>
              )}
              <span className="text-[10px] uppercase tracking-wider bg-white text-zinc-900 px-2.5 py-1 rounded-full font-bold">
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

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-[10px] uppercase tracking-[0.3em] flex flex-col items-center gap-2">
        <span>Découvrir</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
          <path d="M7 0v18m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    </section>
  );
}
