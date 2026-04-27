import { existsSync } from 'fs';
import path from 'path';
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
 * Conversion-optimized landing page for mono-product stores.
 *
 * Layout philosophy: every section answers a friction the cold-traffic visitor
 * has between "I just clicked an ad" and "I just bought it". Hero hooks them,
 * USPs justify the click, comparison removes the price objection, use cases
 * project them in their own life, FAQ kills hesitation, social proof closes.
 */
export function MonoProductLanding({ store, product }: Props) {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price?.calculated_amount;
  const currency = variant?.calculated_price?.currency_code || 'eur';
  const formattedPrice = price !== undefined ? formatMoney(price, currency) : null;
  const compareAtPrice = price !== undefined ? formatMoney(price * 1.6, currency) : null;

  // Hero override: when a curated `current/hero.{png,jpg,jpeg,webp}` exists
  // under public/generated/{slug}/, prefer it over the raw AE thumbnail.
  // That's how we plug the GPU-generated lifestyle shot into the storefront
  // without round-tripping through Medusa's image upload.
  const heroOverride = (() => {
    const dir = path.join(process.cwd(), 'public', 'generated', store.slug, 'current');
    for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
      if (existsSync(path.join(dir, `hero.${ext}`))) {
        return `/generated/${store.slug}/current/hero.${ext}`;
      }
    }
    return null;
  })();
  const imageUrl = heroOverride || product.thumbnail || product.images?.[0]?.url;

  return (
    <div className="bg-white">
      {/* ============== Hero ============== */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${store.primaryColor} 0%, ${store.accentColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_55%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs uppercase tracking-[0.18em] font-medium mb-6">
                <span>{store.logoEmoji}</span>
                <span>{store.name}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif leading-[1.05] mb-5">
                {store.tagline || 'La fraîcheur, où que vous alliez'}
              </h1>
              <p className="text-lg lg:text-xl text-white/85 max-w-xl mb-8 leading-relaxed">
                Un ventilateur de cou bladeless, ultra-silencieux, qui tient toute la journée.
                Aucun cheveu pris, aucune lame visible — juste un courant d&apos;air doux qui vous suit.
              </p>

              {formattedPrice && (
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-5xl font-serif">{formattedPrice}</span>
                  {compareAtPrice && (
                    <span className="text-xl text-white/60 line-through">{compareAtPrice}</span>
                  )}
                  <span className="text-xs uppercase tracking-wider bg-white text-zinc-900 px-2 py-1 rounded font-medium">
                    -38%
                  </span>
                </div>
              )}

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1.5 max-w-md">
                {variant && (
                  <div className="bg-white rounded-xl p-4">
                    <AddToCartButton variantId={variant.id} storeSlug={store.slug} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true">⚡</span> Expédition sous 24h
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true">🔒</span> Paiement sécurisé Stripe
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true">↩</span> Retour 30 jours
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-white/20 blur-3xl rounded-full" aria-hidden="true" />
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-9xl">
                    {store.logoEmoji}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== USPs / Pourquoi ============== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
            Pourquoi {store.name}
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-zinc-900">
            Trois raisons. Aucun compromis.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🪶',
              title: 'Sans pales, sans risque',
              body:
                'La technologie bladeless élimine les lames apparentes. Aucun cheveu pris, aucun doigt en danger — sécurité totale, look épuré.',
            },
            {
              icon: '🔋',
              title: '8 heures d’autonomie',
              body:
                'Une charge USB de 2h vous emmène toute la journée. Écran LED qui affiche le pourcentage restant, comme un téléphone.',
            },
            {
              icon: '🤫',
              title: 'Silencieux, mains libres',
              body:
                'Moins de 35 dB en vitesse 1, soit le bruit d’une bibliothèque. Posé sur le cou, il vous laisse vos deux mains.',
            },
          ].map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-zinc-200 p-6 bg-white hover:border-zinc-300 transition-colors"
            >
              <div className="text-3xl mb-4">{u.icon}</div>
              <h3 className="font-serif text-xl text-zinc-900 mb-2">{u.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== Comparatif ============== */}
      <section className="bg-zinc-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
              Comparatif honnête
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-zinc-900">
              {store.name}, vs. tout le reste.
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                  <th className="text-left px-5 py-4 text-zinc-500 font-medium text-xs uppercase tracking-wider">Critère</th>
                  <th
                    className="text-center px-5 py-4 text-white font-serif text-base"
                    style={{ backgroundColor: store.primaryColor }}
                  >
                    {store.name}
                  </th>
                  <th className="text-center px-5 py-4 text-zinc-400 font-medium text-xs uppercase tracking-wider">
                    Ventilateur USB classique
                  </th>
                  <th className="text-center px-5 py-4 text-zinc-400 font-medium text-xs uppercase tracking-wider">
                    Climatiseur portable
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  ['Mains libres', '✓', '✗', '✗'],
                  ['Sans pales (sécurité)', '✓', '✗', '~'],
                  ['Autonomie 8h', '✓', '~ 3h', '✗ (secteur)'],
                  ['Silencieux < 35 dB', '✓', '~', '✗ 55 dB'],
                  ['Transportable partout', '✓', '~', '✗'],
                  ['Prix', formattedPrice ?? '—', '15-25€', '200-600€'],
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4 font-medium text-zinc-700">{row[0]}</td>
                    <td
                      className="px-5 py-4 text-center font-medium"
                      style={{ color: store.primaryColor }}
                    >
                      {row[1]}
                    </td>
                    <td className="px-5 py-4 text-center text-zinc-500">{row[2]}</td>
                    <td className="px-5 py-4 text-center text-zinc-500">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============== Use cases ============== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
            Quatre moments
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-zinc-900">
            Là où il fait toute la différence.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              emoji: '💼',
              title: 'Au bureau',
              body: 'Quand la clim tombe en panne ou qu’elle ne rafraîchit que la pièce d’à côté.',
            },
            {
              emoji: '🚇',
              title: 'En transports',
              body: 'Métro à 32°C, train sans clim — vous ne descendez plus en sueur.',
            },
            {
              emoji: '🏃',
              title: 'En activité',
              body: 'Course du matin, marche en ville, vélo le soir — toujours discret.',
            },
            {
              emoji: '🌅',
              title: 'En terrasse',
              body: 'Apéro tardif, dîner en plein air, vacances — la fraîcheur reste avec vous.',
            },
          ].map((u) => (
            <div
              key={u.title}
              className="group relative overflow-hidden rounded-2xl p-6 border border-zinc-200 hover:border-zinc-300 transition-all"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, ${store.primaryColor}10 0%, ${store.accentColor}10 100%)`,
                }}
              />
              <div className="relative">
                <div className="text-4xl mb-4">{u.emoji}</div>
                <h3 className="font-serif text-lg text-zinc-900 mb-2">{u.title}</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{u.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== Description produit / Specs ============== */}
      {product.description && (
        <section className="bg-zinc-50 py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
                Le produit, en détail
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-zinc-900">
                {product.title}
              </h2>
            </div>
            <div className="prose prose-zinc max-w-none text-zinc-700 leading-relaxed text-base">
              {product.description.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============== FAQ ============== */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-medium">
            Questions fréquentes
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-serif text-zinc-900">
            On répond à tout.
          </h2>
        </div>
        <div className="divide-y divide-zinc-200 border-y border-zinc-200">
          {[
            {
              q: 'Combien de temps pour la livraison ?',
              a: 'Expédition sous 24h ouvrées. Livraison en France métropolitaine sous 10 à 20 jours en standard. Suivi de commande envoyé par email dès l’expédition.',
            },
            {
              q: 'Le ventilateur est vraiment silencieux ?',
              a: 'Oui. En vitesse 1 il fait moins de 35 dB (l’équivalent d’une bibliothèque). En vitesse 3 il monte à environ 50 dB, ce qui reste plus discret qu’un ventilateur sur pied.',
            },
            {
              q: 'Combien de temps tient la batterie ?',
              a: 'Jusqu’à 8h en vitesse 1, environ 5h en vitesse 2, et 3h en vitesse 3. Recharge complète en 2h via le câble USB-C fourni.',
            },
            {
              q: 'Est-ce que ça prend les cheveux ?',
              a: 'Non. La technologie bladeless utilise des micro-perforations sur le côté du collier, pas de pales rotatives apparentes. Sécurité totale, même cheveux longs.',
            },
            {
              q: 'Et si le produit ne me convient pas ?',
              a: 'Retour gratuit sous 30 jours. Vous nous renvoyez le produit dans son emballage d’origine, on vous rembourse intégralement.',
            },
            {
              q: 'C’est quoi le paiement ?',
              a: 'Stripe sécurisé : carte bancaire, Apple Pay, Google Pay. Vos données ne transitent pas par notre site, tout est chiffré côté Stripe.',
            },
          ].map((f, i) => (
            <details key={i} className="group py-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-medium text-zinc-900 pr-4">{f.q}</span>
                <span className="text-zinc-400 group-open:rotate-45 transition-transform text-2xl leading-none shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ============== Final CTA / Sticky vibe ============== */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background: `linear-gradient(135deg, ${store.primaryColor} 0%, ${store.accentColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.15),transparent_55%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl sm:text-5xl font-serif leading-[1.05] mb-5">
            L’été est trop court pour transpirer.
          </h2>
          <p className="text-lg text-white/85 mb-8 max-w-xl mx-auto">
            Commande maintenant — réception sous 10 à 20 jours. Et si ça ne te plaît pas, on te rembourse.
          </p>
          {variant && (
            <div className="inline-block bg-white rounded-2xl p-2">
              <div className="bg-white rounded-xl p-2">
                <AddToCartButton variantId={variant.id} storeSlug={store.slug} />
              </div>
            </div>
          )}
          {formattedPrice && (
            <p className="mt-6 text-sm text-white/80">
              <span className="font-serif text-2xl">{formattedPrice}</span>
              {compareAtPrice && <span className="ml-2 line-through text-white/50">{compareAtPrice}</span>}
              <span className="ml-2 opacity-80">· livraison incluse</span>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
