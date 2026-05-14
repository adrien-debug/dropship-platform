/**
 * Synthetic store + products used by the admin template gallery preview
 * route (`/admin/templates/[id]/preview`). The data is intentionally
 * neutral so it works for any template (fashion / wellness / events /
 * travel) without looking out of place.
 *
 * NEVER hit this from a real storefront — it's strictly a UI fixture.
 */

import type { StoreConfig } from '@/lib/store-config';
import type { StoreProduct } from '@/lib/medusa-store';
import type { StoreTemplate } from '@/lib/template-catalog';

const NEUTRAL_HERO =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&auto=format&fit=crop&q=80';
const NEUTRAL_CUTOUT =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1024&auto=format&fit=crop&q=80';
const NEUTRAL_LIFESTYLES = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542736667-069246bdbc6d?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1024&auto=format&fit=crop&q=80',
];

export function buildMockStore(template: StoreTemplate): StoreConfig {
  return {
    id: 'preview-store-id',
    slug: 'preview',
    name: 'Maison Aubert',
    niche: 'objets pour la maison',
    tagline: 'Pièces signées par notre atelier européen, faites pour durer.',
    description:
      "Une sélection d'objets pensés pour le quotidien : matières nobles, finitions soignées, fabrication à la commande.",
    primaryColor: '#1a1a1a',
    secondaryColor: '#7a5c3a',
    accentColor: '#7a5c3a',
    logoEmoji: '✦',
    medusaSalesChannelId: 'mock-sc',
    medusaPublishableKey: 'mock-pk',
    status: 'active',
    productCount: 4,
    ga4MeasurementId: null,
    ga4ApiSecret: null,
    metaPixelId: null,
    metaCapiToken: null,
    tiktokPixelId: null,
    tiktokEventsToken: null,
    clarityId: null,
    googleAdsConversionAction: null,
    googleAdsMerchantId: null,
    mode: 'mono',
    heroImageUrl: NEUTRAL_HERO,
    cutoutImageUrl: NEUTRAL_CUTOUT,
    lifestyleImages: NEUTRAL_LIFESTYLES,
    promoVideoUrl: null,
    assetsStatus: 'ready',
    template,
    customDomain: null,
    landingContent: {
      hero: {
        kicker: 'Édition limitée',
        headline_html: 'Le geste d\'atelier, à votre porte.',
        lede: 'Une pièce, fabriquée à la commande, livrée dans un coffret signé.',
      },
      selling_points: [
        { title: 'Matière', body: 'Cuir pleine fleur tanné en France, sélectionné pour son grain et sa tenue dans le temps.' },
        { title: 'Geste', body: 'Coupé, monté, finition main par un artisan unique. Aucune chaîne intermédiaire.' },
        { title: 'Temps', body: 'Six à huit semaines de production. Le rythme d\'un objet pensé pour durer.' },
      ],
      luxury_copy: {
        hero_eyebrow: 'Édition numérotée · Pièce signature',
        hero_lede:
          'Une pièce pensée pour le quotidien lent, posée sur un meuble en chêne huilé ou glissée dans la main au moment de partir.',
        story_headline: 'Derrière cet objet, un atelier, un geste, un temps.',
        story_body: [
          "Nous avons mis du temps à arriver à cette forme. Plusieurs ateliers visités, des matières refusées parce que trop bruyantes. Ce qui reste, c'est ce que vous tenez aujourd'hui.",
          "La pièce est pensée pour vieillir avec son propriétaire. Patiner sans s'effacer. S'adoucir sans se déformer. C'est précisément pour ça qu'elle coûte ce prix.",
        ],
        atelier_pillars: [
          { title: 'Matière', body: 'Une seule provenance, sélectionnée par notre directeur d\'atelier. La main reconnaît la matière noble.' },
          { title: 'Geste', body: "Chaque pièce passe entre les mains d'un artisan unique, de la coupe à la finition." },
          { title: 'Temps', body: 'Six à huit semaines pour qu\'une commande devienne un objet.' },
        ],
        price_rationale: "Pour cette pièce, matière noble, atelier européen, finition main, le prix tient compte du temps réel passé.",
        packaging_headline: "L'écrin compte autant que la pièce.",
        packaging_body: "Coffret signature, certificat d'authenticité, guide d'entretien, note manuscrite de l'atelier.",
        final_cta_note: 'Production à la commande. Six à huit semaines. Livraison offerte. Retours sous trente jours.',
      },
    },
    designPreset: null,
    palette: null,
  } as StoreConfig;
}

export function buildMockProducts(): StoreProduct[] {
  const make = (i: number): StoreProduct => ({
    id: `mock-prod-${i}`,
    title: TITLES[i % TITLES.length]!,
    handle: `mock-product-${i}`,
    description:
      "Conçu pour durer, fabriqué à la commande dans notre atelier. Un objet pensé pour le quotidien lent et l'usage quotidien.",
    thumbnail: PRODUCT_IMGS[i % PRODUCT_IMGS.length]!,
    images: [
      { url: PRODUCT_IMGS[i % PRODUCT_IMGS.length]! },
      { url: PRODUCT_IMGS[(i + 1) % PRODUCT_IMGS.length]! },
    ],
    variants: [
      {
        id: `mock-variant-${i}`,
        title: 'Standard',
        sku: `MOCK-${i}`,
        inventory_quantity: 12,
        manage_inventory: true,
        calculated_price: {
          calculated_amount: 24900 + i * 7000,
          original_amount: 24900 + i * 7000,
          currency_code: 'eur',
        },
      },
    ],
    tags: [],
  });
  return [make(0), make(1), make(2), make(3)];
}

const TITLES = [
  'Portefeuille bridé',
  'Pochette nocturne',
  'Sac d\'atelier',
  'Étui document',
];

const PRODUCT_IMGS = [
  'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1024&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1024&auto=format&fit=crop&q=80',
];
