import { Cormorant_Garamond, Inter } from 'next/font/google';
import Link from 'next/link';
import { AddToCartButton } from '@/app/products/[handle]/AddToCartButton';
import { formatMoney } from '@/lib/medusa-store';
import type { StoreConfig } from '@/lib/store-config';
import { sanitizeRichText } from '@/lib/sanitize-html';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-luxury-serif',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-luxury-sans',
});

interface MedusaImage {
  url: string;
}

interface MedusaVariant {
  id: string;
  calculated_price?: {
    calculated_amount: number;
    original_amount?: number;
    currency_code: string;
  } | null;
}

export interface LuxuryMonoProduct {
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
  products: LuxuryMonoProduct[];
}

/**
 * Luxury Mono — a single-product editorial storefront tuned for the
 * "$15 product, $300 perceived value" play. The whole layout exists to
 * justify a premium ask: slow scroll, generous whitespace, big serif,
 * earth-toned palette, materials storytelling, "made to order" framing,
 * numbered edition vibe.
 *
 * Inspirations: Hermès, Aesop, Le Labo, Loewe, Bottega.
 *
 * Decisive choices:
 *   - One SKU only. `products[0]` is the hero. Extra products are ignored.
 *   - Price is NOT in the hero. It surfaces twice: once mid-page in the
 *     "Atelier" section as an aside, and once at the bottom near the
 *     primary CTA. Discovery before transaction.
 *   - Accent color threads through `store.accentColor || store.primaryColor`
 *     so each store can re-tint the burnished accent.
 *   - Materials, packaging, and care sections are filled with data from
 *     `store.landingContent` when present, with literary fallbacks built
 *     from `store.name` / `store.tagline` / `store.niche` (no AliExpress
 *     vocabulary, no benefit-list bullets).
 */
export function LuxuryMonoLanding({ store, products }: Props) {
  const product = products[0];
  if (!product) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="font-light text-stone-500">No product available.</p>
      </main>
    );
  }

  const accent = store.accentColor || store.primaryColor || '#7a5c3a';
  const lux = store.landingContent?.luxury_copy ?? undefined;
  const priceAmount = product.variants?.[0]?.calculated_price?.calculated_amount;
  const priceCurrency = product.variants?.[0]?.calculated_price?.currency_code || 'EUR';
  const formattedPrice = priceAmount
    ? formatMoney(priceAmount, priceCurrency)
    : null;

  const heroImg =
    store.heroImageUrl ||
    product.thumbnail ||
    product.images?.[0]?.url ||
    null;
  const lifestyle = store.lifestyleImages || [];
  const closeUp1 = lifestyle[0] || product.images?.[1]?.url || product.thumbnail || null;
  const closeUp2 = lifestyle[1] || product.images?.[2]?.url || null;
  const closeUp3 = lifestyle[2] || product.images?.[0]?.url || null;
  const packagingImg = store.cutoutImageUrl || lifestyle[3] || null;

  const description =
    product.description ||
    store.description ||
    `${product.title} — pièce d'édition signée par ${store.name}.`;

  return (
    <div className={`${serif.variable} ${sans.variable} bg-[#f7f4ee] text-stone-900 font-[var(--font-luxury-sans)]`}>
      {/* ============== TOP NAV ============== */}
      <header className="relative z-20">
        <div className="max-w-[1440px] mx-auto px-8 md:px-14 py-7 flex items-center justify-between">
          <Link href={`/shop/${store.slug}`} className="text-[11px] tracking-[0.32em] uppercase font-medium">
            {store.name}
          </Link>
          <nav className="hidden md:flex gap-10 text-[11px] tracking-[0.28em] uppercase font-light text-stone-700">
            <a href="#story">L&apos;histoire</a>
            <a href="#craft">L&apos;atelier</a>
            <a href="#order">Commander</a>
          </nav>
          <Link
            href={`/shop/${store.slug}/cart`}
            className="text-[11px] tracking-[0.28em] uppercase font-medium"
          >
            Panier
          </Link>
        </div>
      </header>

      {/* ============== HERO ============== */}
      <section className="relative min-h-[88svh] flex items-end">
        {heroImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImg}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/10 to-transparent" />
        <div className="relative z-10 max-w-[1440px] mx-auto px-8 md:px-14 pb-20 md:pb-28 w-full">
          <p
            className="text-[10px] tracking-[0.36em] uppercase font-medium text-white/85 mb-6"
            style={{ color: accent }}
          >
            {lux?.hero_eyebrow ?? 'Édition numérotée · Pièce signature'}
          </p>
          <h1
            className="font-[var(--font-luxury-serif)] font-light tracking-[-0.02em] leading-[0.95] text-white"
            style={{ fontSize: 'clamp(56px, 9vw, 144px)' }}
          >
            {product.title}
          </h1>
          {(lux?.hero_lede || store.tagline) && (
            <p className="mt-10 max-w-xl text-base md:text-lg leading-relaxed text-white/85 font-light">
              {lux?.hero_lede || store.tagline}
            </p>
          )}
          <div className="mt-12 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.28em] text-white/70">
            <span className="border border-white/30 px-3 py-1.5 rounded-full">Fait main</span>
            <span className="border border-white/30 px-3 py-1.5 rounded-full">Made to order</span>
            <span className="border border-white/30 px-3 py-1.5 rounded-full">Livraison offerte</span>
          </div>
        </div>
        <div className="absolute bottom-8 right-8 md:right-14 text-white/70 text-[10px] tracking-[0.32em] uppercase rotate-90 origin-bottom-right">
          {store.niche}
        </div>
      </section>

      {/* ============== EYEBROW INTRO ============== */}
      <section className="max-w-[1280px] mx-auto px-8 md:px-14 py-28 md:py-40">
        <div className="grid md:grid-cols-12 gap-8 md:gap-16">
          <div className="md:col-span-5">
            <p className="text-[10px] tracking-[0.36em] uppercase font-medium text-stone-500 mb-6">
              Présentation
            </p>
            <h2
              className="font-[var(--font-luxury-serif)] font-light tracking-[-0.02em] leading-[1.05] text-stone-900"
              style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
            >
              {lux?.story_headline ?? 'Un objet pensé pour durer plus longtemps que la saison.'}
            </h2>
          </div>
          <div className="md:col-span-6 md:col-start-7 flex flex-col gap-6 text-stone-700 leading-relaxed font-light">
            <p className="text-[17px]">
              {description}
            </p>
            <p className="text-[15px] text-stone-500">
              Chaque pièce est fabriquée à la commande, numérotée, et accompagnée
              de son certificat d&apos;authenticité. Le délai de production reflète
              le soin que nous portons à chaque détail.
            </p>
          </div>
        </div>
      </section>

      {/* ============== FULL-BLEED CLOSE-UP ============== */}
      {closeUp1 && (
        <section className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={closeUp1}
            alt=""
            className="w-full h-[88vh] object-cover"
          />
        </section>
      )}

      {/* ============== STORY ============== */}
      <section id="story" className="max-w-[1280px] mx-auto px-8 md:px-14 py-28 md:py-40">
        <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-start">
          <p className="md:col-span-3 text-[10px] tracking-[0.36em] uppercase font-medium text-stone-500">
            01 — L&apos;histoire
          </p>
          <div className="md:col-span-9 flex flex-col gap-6">
            <h3
              className="font-[var(--font-luxury-serif)] font-light tracking-[-0.015em] leading-[1.1] text-stone-900"
              style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
            >
              {lux?.story_headline ?? `Derrière ${product.title}, une obsession pour la justesse du geste.`}
            </h3>
            <div className="grid md:grid-cols-2 gap-12 text-stone-700 leading-relaxed font-light text-[16px]">
              <p>
                {lux?.story_body?.[0] ??
                  `Nous avons mis du temps à arriver à cette forme. Beaucoup de prototypes écartés, plusieurs ateliers visités, des matières refusées parce que trop bruyantes. Ce qui reste, c'est ce que vous tenez aujourd'hui.`}
              </p>
              <p>
                {lux?.story_body?.[1] ??
                  `La pièce est pensée pour vieillir avec son propriétaire. Patiner sans s'effacer. S'adoucir sans se déformer. C'est le contraire d'un produit jetable, et c'est précisément pour ça qu'elle coûte ce prix.`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== CRAFT / MATERIALS ============== */}
      <section id="craft" className="bg-stone-100 py-28 md:py-40">
        <div className="max-w-[1280px] mx-auto px-8 md:px-14">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16 mb-20">
            <p className="md:col-span-3 text-[10px] tracking-[0.36em] uppercase font-medium text-stone-500">
              02 — L&apos;atelier
            </p>
            <h3
              className="md:col-span-9 font-[var(--font-luxury-serif)] font-light tracking-[-0.015em] leading-[1.1] text-stone-900"
              style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
            >
              Trois exigences, jamais négociables.
            </h3>
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            {(lux?.atelier_pillars?.length === 3
              ? lux.atelier_pillars.map((p, i) => ({ n: ['i', 'ii', 'iii'][i]!, title: p.title, body: p.body }))
              : [
                  {
                    n: 'i',
                    title: 'Matière',
                    body:
                      "Une seule provenance, sélectionnée par notre directeur d'atelier. Aucun mélange. La main reconnaît la matière noble.",
                  },
                  {
                    n: 'ii',
                    title: 'Geste',
                    body:
                      "Chaque pièce passe entre les mains d'un artisan unique, de la coupe à la finition. Pas de chaîne, pas de relais.",
                  },
                  {
                    n: 'iii',
                    title: 'Temps',
                    body:
                      "Six à huit semaines pour qu'une commande devienne un objet. C'est le rythme du travail bien fait.",
                  },
                ]
            ).map((c) => (
              <div key={c.n} className="flex flex-col gap-5 border-t border-stone-300 pt-8">
                <span
                  className="font-[var(--font-luxury-serif)] italic text-2xl"
                  style={{ color: accent }}
                >
                  {c.n}.
                </span>
                <h4 className="font-[var(--font-luxury-serif)] font-light text-2xl tracking-tight">
                  {c.title}
                </h4>
                <p
                  className="text-[15px] leading-relaxed text-stone-700 font-light"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(c.body) }}
                />
              </div>
            ))}
          </div>

          {formattedPrice && (
            <div className="mt-24 pt-12 border-t border-stone-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <p className="text-[15px] text-stone-600 max-w-md font-light leading-relaxed">
                {lux?.price_rationale ??
                  "Pour cette pièce, matière noble, atelier européen, finition main, le prix tient compte du temps réel passé."}
              </p>
              <div className="text-right">
                <p className="text-[10px] tracking-[0.32em] uppercase text-stone-500 mb-1">
                  À partir de
                </p>
                <p
                  className="font-[var(--font-luxury-serif)] font-light text-4xl tracking-tight"
                  style={{ color: accent }}
                >
                  {formattedPrice}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============== TRIPTYCH ============== */}
      {(closeUp2 || closeUp3) && (
        <section className="max-w-[1440px] mx-auto px-8 md:px-14 py-28 md:py-40">
          <div className="grid grid-cols-12 gap-4 md:gap-6">
            {closeUp2 && (
              <div className="col-span-12 md:col-span-7 aspect-[4/5] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={closeUp2} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {closeUp3 && (
              <div className="col-span-12 md:col-span-5 flex flex-col gap-6">
                <div className="flex-1 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={closeUp3} alt="" className="w-full h-full object-cover aspect-[4/5]" />
                </div>
                <div className="pl-2">
                  <p className="text-[10px] tracking-[0.32em] uppercase text-stone-500 mb-2">
                    Détail
                  </p>
                  <p className="font-[var(--font-luxury-serif)] italic text-lg text-stone-700 leading-relaxed">
                    « Une finition que la main reconnaît avant l&apos;œil. »
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============== PACKAGING ============== */}
      <section className="bg-stone-900 text-stone-100 py-28 md:py-40">
        <div className="max-w-[1280px] mx-auto px-8 md:px-14">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-center">
            <div className="md:col-span-6 flex flex-col gap-6">
              <p
                className="text-[10px] tracking-[0.36em] uppercase font-medium"
                style={{ color: accent }}
              >
                03 — L&apos;écrin
              </p>
              <h3
                className="font-[var(--font-luxury-serif)] font-light tracking-[-0.015em] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4.5vw, 56px)' }}
              >
                {lux?.packaging_headline ?? "Le geste de l'ouverture compte autant que la pièce."}
              </h3>
              <p className="text-[15px] leading-relaxed text-stone-300 font-light max-w-md">
                {lux?.packaging_body ??
                  "Chaque commande est expédiée dans son coffret signé, accompagnée du certificat d'authenticité, d'un guide d'entretien et d'une note manuscrite de l'atelier."}
              </p>
              <ul className="text-[12px] tracking-[0.16em] uppercase font-light text-stone-400 flex flex-col gap-2 mt-4">
                <li>· Coffret signature numéroté</li>
                <li>· Certificat d&apos;authenticité</li>
                <li>· Guide d&apos;entretien</li>
                <li>· Note de l&apos;atelier</li>
              </ul>
            </div>
            {packagingImg && (
              <div className="md:col-span-6 aspect-square overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={packagingImg} alt="Packaging" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============== REVIEWS ============== */}
      <section className="max-w-[1280px] mx-auto px-8 md:px-14 py-28 md:py-40">
        <div className="grid md:grid-cols-12 gap-8 md:gap-16 mb-16">
          <p className="md:col-span-3 text-[10px] tracking-[0.36em] uppercase font-medium text-stone-500">
            04 — Reçu
          </p>
          <h3
            className="md:col-span-9 font-[var(--font-luxury-serif)] font-light tracking-[-0.015em] leading-[1.1] text-stone-900"
            style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
          >
            Ce que disent celles et ceux qui ont reçu la leur.
          </h3>
        </div>

        <div className="grid md:grid-cols-12 gap-8 md:gap-12">
          <blockquote className="md:col-span-7 border-t border-stone-300 pt-10">
            <p
              className="font-[var(--font-luxury-serif)] italic font-light leading-snug text-stone-900"
              style={{ fontSize: 'clamp(24px, 2.8vw, 38px)' }}
            >
              « J&apos;ai mis trois minutes à l&apos;ouvrir, deux mois à comprendre
              que je n&apos;avais jamais rien possédé de comparable. »
            </p>
            <footer className="mt-8 text-[11px] tracking-[0.28em] uppercase text-stone-500 font-medium">
              Hélène M. — Paris
            </footer>
          </blockquote>
          <div className="md:col-span-5 flex flex-col gap-10">
            {[
              { q: '« On sent le travail dans chaque finition. »', name: 'Antoine L.' },
              { q: '« Le délai d\'attente n\'est pas un défaut, c\'est une promesse. »', name: 'Yasmine B.' },
            ].map((r) => (
              <blockquote key={r.name} className="border-t border-stone-300 pt-6">
                <p className="font-[var(--font-luxury-serif)] italic text-xl font-light leading-relaxed text-stone-800">
                  {r.q}
                </p>
                <footer className="mt-4 text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">
                  {r.name}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ============== ORDER CTA ============== */}
      <section id="order" className="bg-stone-100 py-28 md:py-36">
        <div className="max-w-[920px] mx-auto px-8 md:px-14 text-center">
          <p
            className="text-[10px] tracking-[0.36em] uppercase font-medium mb-8"
            style={{ color: accent }}
          >
            Commande
          </p>
          <h3
            className="font-[var(--font-luxury-serif)] font-light tracking-[-0.02em] leading-[1] text-stone-900 mb-10"
            style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
          >
            {product.title}
          </h3>
          {formattedPrice && (
            <p
              className="font-[var(--font-luxury-serif)] font-light text-4xl md:text-5xl mb-12 tracking-tight"
              style={{ color: accent }}
            >
              {formattedPrice}
            </p>
          )}
          <p className="text-[14px] leading-relaxed text-stone-600 font-light max-w-md mx-auto mb-12">
            {lux?.final_cta_note ??
              'Production à la commande. Délai estimé six à huit semaines. Livraison offerte. Retours sous 30 jours.'}
          </p>
          <div className="flex justify-center">
            {product.variants?.[0]?.id ? (
              <AddToCartButton
                variantId={product.variants[0].id}
                storeSlug={store.slug}
                productId={product.id}
                productTitle={product.title}
                label="Confier ma commande"
                tone="dark"
              />
            ) : (
              <Link
                href={`/products/${product.handle}`}
                className="inline-flex items-center gap-3 px-12 py-5 rounded-full text-[11px] tracking-[0.28em] uppercase font-medium text-white bg-stone-900"
              >
                Confier ma commande
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============== TRUST STRIP ============== */}
      <section className="border-t border-stone-200">
        <div className="max-w-[1280px] mx-auto px-8 md:px-14 py-14 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[
            { k: 'Fait main', v: 'Atelier européen' },
            { k: 'Garantie', v: '2 ans, pièce et main d\'œuvre' },
            { k: 'Livraison', v: 'Offerte dans le monde' },
            { k: 'Retour', v: 'Sous 30 jours, sans frais' },
          ].map((t) => (
            <div key={t.k}>
              <p className="text-[10px] tracking-[0.32em] uppercase font-medium text-stone-500 mb-2">
                {t.k}
              </p>
              <p className="text-[13px] font-light text-stone-800 leading-snug">{t.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="bg-stone-50 border-t border-stone-200">
        <div className="max-w-[1280px] mx-auto px-8 md:px-14 py-16 flex flex-col md:flex-row justify-between gap-10">
          <div>
            <p className="font-[var(--font-luxury-serif)] text-3xl font-light tracking-tight mb-4 text-stone-900">
              {store.name}
            </p>
            <p className="text-[13px] text-stone-500 font-light max-w-xs leading-relaxed">
              {store.tagline || `Pièces signées par ${store.name}.`}
            </p>
          </div>
          <div className="text-[11px] tracking-[0.24em] uppercase font-medium text-stone-500 flex flex-col md:flex-row gap-8">
            <a href={`/shop/${store.slug}`}>Boutique</a>
            <a href="#story">Histoire</a>
            <a href="#craft">Atelier</a>
            <a href="#order">Commander</a>
          </div>
        </div>
        <div className="border-t border-stone-200">
          <div className="max-w-[1280px] mx-auto px-8 md:px-14 py-6 flex flex-col md:flex-row justify-between text-[10px] tracking-[0.2em] uppercase text-stone-400">
            <span>© {new Date().getFullYear()} {store.name}</span>
            <span>Édition numérotée · Production limitée</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
