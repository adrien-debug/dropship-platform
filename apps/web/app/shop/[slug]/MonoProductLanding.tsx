import { existsSync, readdirSync } from 'fs';
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
  Stat,
  NumberMark,
  TrustItem,
  Stars,
  Parallax,
  Pullquote,
  Marquee,
  ImagePlate,
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

interface GalleryShot {
  src: string;
  caption: string;
  tag: string;
}

/**
 * Walk public/generated/{slug}/run-*-flux-kontext-real-product/ and surface the
 * shots that hold up. Keeps the gallery declarative — adding a new render
 * means dropping a PNG with one of the known basenames into that folder.
 *
 * The blacklist excludes the obvious mismatches (dark studio shots that
 * don't fit the bright editorial mood). Captions are baked here because the
 * Kontext filenames carry semantic meaning we want to surface.
 */
const GALLERY_CAPTIONS: Record<string, { caption: string; tag: string }> = {
  beach_terrace: { caption: 'Du bureau à la plage,\nsans transition.', tag: 'En vacances' },
  cafe_terrace: { caption: 'Pause café, sans transpirer.', tag: 'En ville' },
  rooftop_evening: { caption: 'Apéro rooftop, mains libres.', tag: 'Apéro' },
  metro_commute: { caption: 'Le métro, en silence.', tag: 'Trajet' },
  office_summer: { caption: 'L’open-space, climatisé pour soi.', tag: 'Au bureau' },
  home_kitchen: { caption: 'Le dîner, sans la cuisson.', tag: 'À la maison' },
  running_seine: { caption: 'Footing matinal, fraîcheur garantie.', tag: 'Au sport' },
};
const GALLERY_BLACKLIST = new Set(['hero_dark_studio']);

function discoverGalleryImages(slug: string): GalleryShot[] {
  const root = path.join(process.cwd(), 'public', 'generated', slug);
  if (!existsSync(root)) return [];
  const out: GalleryShot[] = [];
  for (const dirent of readdirSync(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    if (!dirent.name.includes('flux-kontext-real-product')) continue;
    const runDir = path.join(root, dirent.name);
    for (const f of readdirSync(runDir)) {
      const m = f.match(/^(.+)\.(png|webp|jpe?g)$/i);
      if (!m) continue;
      const base = m[1].toLowerCase();
      if (GALLERY_BLACKLIST.has(base)) continue;
      const meta = GALLERY_CAPTIONS[base];
      if (!meta) continue;
      out.push({
        src: `/generated/${slug}/${dirent.name}/${f}`,
        caption: meta.caption,
        tag: meta.tag,
      });
    }
  }
  // Stable order matching the captions dict declaration.
  const order = Object.keys(GALLERY_CAPTIONS);
  out.sort((a, b) => {
    const ka = order.findIndex((k) => a.src.includes(`/${k}.`));
    const kb = order.findIndex((k) => b.src.includes(`/${k}.`));
    return ka - kb;
  });
  return out;
}

/**
 * Long-form mono-product landing page, built exclusively from the
 * `components/ui` primitives. Layout:
 *
 *   1. Hero (parallax bg image, italic-accented H1, fades)
 *   2. Press marquee (continuous scrolling endorsement strip)
 *   3. Social proof bar (4 stats)
 *   4. Trois raisons (numbered USPs)
 *   5. 3D Showcase (R3F billboard + airflow particles, 80vh tall)
 *   6. Pullquote (editorial italic statement)
 *   7. Lifestyle gallery (auto-discovered Kontext shots, uniform grade)
 *   8. Beach moment (single full-bleed Kontext + parallax)
 *   9. Specs (10-row table)
 *  10. Trois gestes (process, with custom monoline icons)
 *  11. Inclus dans le pack (4 cards)
 *  12. Témoignages
 *  13. Comparatif
 *  14. FAQ
 *  15. Final CTA
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

  const galleryShots = discoverGalleryImages(store.slug);

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

      {/* ================== PRESS MARQUEE ================== */}
      <Section tone="light" padding="sm" className="border-b border-zinc-200">
        <Marquee
          duration={48}
          items={[
            'Élu produit innovation été 2026',
            'Vu dans Konbini Tech',
            '— 38 % vs prix marché',
            'Made for summer 2026',
            'Garantie 24 mois',
            'Stripe · Apple Pay · Google Pay',
          ].map((label, i) => (
            <span key={i} className="font-serif italic text-zinc-500 text-base sm:text-lg whitespace-nowrap">
              {label}
            </span>
          ))}
        />
      </Section>

      {/* ================== SOCIAL PROOF ================== */}
      <Section tone="muted" padding="md" className="border-b border-zinc-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Stat value="12 400" label="Clients en France" />
          <Stat value="4.7 / 5" label="Note moyenne" />
          <Stat value="< 24h" label="Expédition" />
          <Stat value="2 ans" label="Garantie" />
        </div>
      </Section>

      {/* ================== TROIS RAISONS ================== */}
      <Section tone="light" padding="lg">
        <SectionHeader kicker="Conception" title={<>Trois raisons. <em className="font-serif italic text-zinc-500">Aucun</em> compromis.</>} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 mt-14 border border-zinc-200 rounded-2xl overflow-hidden">
          {[
            {
              num: '01',
              title: 'Sans pales, sans risque',
              body:
                'Technologie bladeless avec micro-perforations latérales. Aucun cheveu pris, aucun doigt en danger. Sécurité totale, design épuré.',
            },
            {
              num: '02',
              title: 'Huit heures d’autonomie',
              body:
                'Batterie 4 000 mAh, recharge complète en 2h via USB-C. Écran LED qui affiche le pourcentage restant comme un téléphone.',
            },
            {
              num: '03',
              title: 'Silencieux, mains libres',
              body:
                'Moins de 35 dB en vitesse 1 — l’équivalent d’une bibliothèque. Posé sur le cou, il vous laisse vos deux mains entièrement libres.',
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

      {/* ================== PRODUCT SHOWCASE 3D ================== */}
      {cutoutImage && (
        <Section tone="dark" padding="xl">
          <SectionHeader
            kicker="Démonstration"
            title={<>Un courant d’air, <em className="font-serif italic text-white/70">jamais</em> une rafale.</>}
            lede="Bladeless. Silencieux. Mains libres. Faites-le tourner avec la souris."
            tone="inverse"
            size="xl"
          />
          <div className="mt-14 sm:mt-16 max-w-[1400px] mx-auto">
            <ProductShowcase
              imageUrl={cutoutImage}
              alt={product.title}
              primaryColor={store.primaryColor}
              accentColor={store.accentColor}
              tag="360° · interactif"
              caption="Cliquez et glissez pour faire tourner"
              aspect="16/10"
            />
          </div>
        </Section>
      )}

      {/* ================== PULLQUOTE ================== */}
      <Section tone="light" padding="lg" width="default">
        <Pullquote
          accentColor={store.primaryColor}
          attribution={<>Note de design · Adrien P., directeur produit</>}
        >
          «&nbsp;On a passé deux ans à dessiner un objet qui se fait oublier.
          Posez-le sur le cou. Au bout d’une minute, vous ne savez plus qu’il est là —
          il ne reste que la fraîcheur.&nbsp;»
        </Pullquote>
      </Section>

      {/* ================== LIFESTYLE GALLERY ================== */}
      {galleryShots.length >= 3 && (
        <Section tone="muted" padding="lg" innerClassName="!px-0 sm:!px-8 lg:!px-12">
          <div className="px-6 sm:px-0">
            <SectionHeader
              kicker="Au quotidien"
              title={<>Là où il <em className="font-serif italic text-zinc-500">vous suit</em>.</>}
              lede="Sept moments de la journée d’été. Le même objet, sept fois oublié."
            />
          </div>
          <div className="mt-14 grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
            {galleryShots.map((shot, i) => (
              <ImagePlate
                key={shot.src}
                src={shot.src}
                alt={shot.tag}
                tag={shot.tag}
                caption={shot.caption.split('\n').map((line, k, arr) => (
                  <span key={k}>
                    {line}
                    {k < arr.length - 1 && <br />}
                  </span>
                ))}
                aspect={i % 5 === 0 ? '4/5' : i % 5 === 2 ? '1/1' : '4/5'}
                grade="cool"
              />
            ))}
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
          title={<>Trois gestes. <em className="font-serif italic text-white/60">C’est tout.</em></>}
          tone="inverse"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mt-16">
          {[
            {
              num: '01',
              icon: 'charge' as const,
              title: 'Charger',
              body: 'Branchez le câble USB-C fourni. La LED clignote pendant la charge, devient fixe à 100% (environ 2h).',
            },
            {
              num: '02',
              icon: 'wear' as const,
              title: 'Porter',
              body: 'Le collier flexible s’ouvre largement, se pose autour du cou, et se referme tout seul. Aucun réglage.',
            },
            {
              num: '03',
              icon: 'blow' as const,
              title: 'Souffler',
              body: 'Bouton unique. Vitesse 1 brise discrète, 2 ventilation soutenue, 3 souffle puissant.',
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

      {/* ================== TÉMOIGNAGES ================== */}
      <Section tone="muted" padding="lg">
        <SectionHeader kicker="Avis vérifiés" title="Ce qu’elles et ils en disent." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
          {[
            {
              quote: 'Je l’utilise tous les jours dans le métro entre Châtelet et La Défense. Plus jamais sans.',
              author: 'Sophie M.',
              detail: 'Paris · juin 2025',
            },
            {
              quote: 'Bluffé par le silence. Je le porte au bureau, personne ne l’entend. Et la batterie tient deux jours.',
              author: 'Marc D.',
              detail: 'Lyon · juillet 2025',
            },
            {
              quote: 'Cadeau pour ma mère qui supporte mal la chaleur. Adoptée immédiatement, elle ne le quitte plus.',
              author: 'Léa B.',
              detail: 'Bordeaux · août 2025',
            },
          ].map((t, i) => (
            <figure
              key={i}
              className="bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col transition-all duration-300 hover:border-zinc-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.25)]"
            >
              <Stars color={store.accentColor} />
              <blockquote className="font-serif text-lg text-zinc-800 leading-snug flex-1 mt-5">
                «&nbsp;{t.quote}&nbsp;»
              </blockquote>
              <figcaption className="mt-6 pt-6 border-t border-zinc-100">
                <div className="font-medium text-sm text-zinc-900">{t.author}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{t.detail}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* ================== COMPARATIF ================== */}
      <Section tone="light" padding="lg">
        <div className="max-w-5xl mx-auto">
          <SectionHeader kicker="Comparatif" title="Brisa, vs. tout le reste." />
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white mt-14">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                  <th className="text-left px-6 py-4 text-zinc-500 font-medium text-xs uppercase tracking-[0.18em]">
                    Critère
                  </th>
                  <th
                    className="text-center px-6 py-4 text-white font-serif text-base"
                    style={{ backgroundColor: store.primaryColor }}
                  >
                    Brisa
                  </th>
                  <th className="text-center px-6 py-4 text-zinc-400 font-medium text-xs uppercase tracking-[0.18em]">
                    Ventilateur USB classique
                  </th>
                  <th className="text-center px-6 py-4 text-zinc-400 font-medium text-xs uppercase tracking-[0.18em]">
                    Climatiseur portable
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  ['Mains libres', 'Oui', 'Non', 'Non'],
                  ['Sans pales (sécurité)', 'Oui', 'Non', 'Partielle'],
                  ['Autonomie 8h', 'Oui', '~ 3h', 'Secteur uniquement'],
                  ['Silencieux < 35 dB', 'Oui', 'Variable', 'Non, ~ 55 dB'],
                  ['Transportable partout', 'Oui', 'Limité', 'Non'],
                  ['Prix', formattedPrice ?? '—', '15 à 25 €', '200 à 600 €'],
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 font-medium text-zinc-700">{row[0]}</td>
                    <td
                      className="px-6 py-4 text-center font-medium"
                      style={{ color: store.primaryColor }}
                    >
                      {row[1]}
                    </td>
                    <td className="px-6 py-4 text-center text-zinc-500">{row[2]}</td>
                    <td className="px-6 py-4 text-center text-zinc-500">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ================== FAQ ================== */}
      <Section tone="muted" padding="lg" width="narrow">
        <SectionHeader kicker="Questions fréquentes" title="On répond à tout." />
        <div className="divide-y divide-zinc-200 border-y border-zinc-200 mt-14">
          {[
            { q: 'Combien de temps pour la livraison ?', a: 'Expédition sous 24h ouvrées. Livraison en France métropolitaine sous 7 à 15 jours. Suivi de commande envoyé par email dès l’expédition.' },
            { q: 'Le ventilateur est vraiment silencieux ?', a: 'Oui. En vitesse 1 il fait moins de 35 dB (l’équivalent d’une bibliothèque). En vitesse 3 il monte à environ 50 dB, ce qui reste plus discret qu’un ventilateur sur pied.' },
            { q: 'Combien de temps tient la batterie ?', a: 'Jusqu’à 8h en vitesse 1, environ 5h en vitesse 2, et 3h en vitesse 3. Recharge complète en 2h via le câble USB-C fourni.' },
            { q: 'Est-ce que ça prend les cheveux ?', a: 'Non. La technologie bladeless utilise des micro-perforations sur le côté du collier, pas de pales rotatives apparentes. Sécurité totale, même cheveux longs.' },
            { q: 'C’est compatible avec quelle taille de cou ?', a: 'Le collier est flexible et s’adapte aux tours de cou de 28 à 48 cm. Cela couvre la quasi-totalité des morphologies adultes.' },
            { q: 'Et si le produit ne me convient pas ?', a: 'Retour gratuit sous 30 jours. Vous nous renvoyez le produit dans son emballage d’origine, on vous rembourse intégralement.' },
            { q: 'C’est quoi le paiement ?', a: 'Stripe sécurisé : carte bancaire, Apple Pay, Google Pay. Vos données ne transitent pas par notre site, tout est chiffré côté Stripe.' },
            { q: 'Quelle est la garantie ?', a: 'Garantie constructeur de 24 mois. En cas de défaut, on remplace le produit ou on rembourse, sans débat.' },
          ].map((f, i) => (
            <details key={i} className="group py-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-medium text-zinc-900 pr-4">{f.q}</span>
                <span className="text-zinc-400 group-open:rotate-45 transition-transform text-2xl leading-none shrink-0 font-light">+</span>
              </summary>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
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
              Commandez maintenant, recevez sous 7 à 15 jours. Si ça ne vous plaît pas, on rembourse intégralement.
            </Lede>
          </div>
          {variant && (
            <div className="mt-12 inline-block w-full max-w-sm bg-white rounded-3xl shadow-2xl text-left">
              <CartCard variantId={variant.id} storeSlug={store.slug} tone="dark" />
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
  // Falls back to the full string if there's only one word.
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
        // Background image runs slower than scroll → classic depth cue.
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
        {/* Foreground text rises slightly faster than scroll for parallax separation. */}
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
              Un ventilateur de cou bladeless, ultra-silencieux, qui tient toute la journée. Aucun cheveu pris, aucune lame visible — juste un courant d&apos;air doux qui vous suit.
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
            <div className="brisa-fade-3 mt-8 max-w-sm">
              <div className="bg-white rounded-3xl shadow-2xl">
                <CartCard variantId={variant.id} storeSlug={store.slug} tone="dark" />
              </div>
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

/**
 * The CTA card that wraps the AddToCartButton. Centralized so the visual
 * (white card, generous padding, label above) is identical wherever it
 * appears (hero, final CTA).
 */
function CartCard({
  variantId,
  storeSlug,
  tone = 'dark',
}: {
  variantId: string;
  storeSlug: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium mb-3">
        Quantité
      </div>
      <AddToCartButton variantId={variantId} storeSlug={storeSlug} tone={tone} />
    </div>
  );
}
