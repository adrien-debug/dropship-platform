/**
 * Single source of truth for storefront templates.
 *
 * Each entry describes a template available to the dropshipping platform.
 * The agent that creates a store reads this catalog to suggest a fit based on
 * the product's niche, register, and modality. The admin selector and the zod
 * validator at /api/agent/stores/:id PATCH also derive from this list.
 *
 * Adding a new template requires three things:
 *  1. Create the React component in app/shop/[slug]/<Name>Landing.tsx
 *  2. Append the entry below (id + metadata)
 *  3. Add the render branch in app/shop/[slug]/page.tsx
 */

export type TemplateNiche =
  | 'fashion'
  | 'beauty'
  | 'wellness'
  | 'health'
  | 'home'
  | 'pet'
  | 'tech'
  | 'food'
  | 'beverage'
  | 'jewelry'
  | 'travel'
  | 'events'
  | 'sport'
  | 'editorial'
  | 'gifting'
  | 'kids';

export type TemplateRegister = 'mass' | 'premium' | 'luxury';
export type TemplateMode = 'mono' | 'collection' | 'editorial' | 'split';
export type TemplateMood =
  | 'minimal'
  | 'bold'
  | 'soft'
  | 'dark'
  | 'serif'
  | 'sans'
  | 'playful'
  | 'cinematic'
  | 'organic';

export interface TemplateCatalogEntry {
  id: string;
  label: string;
  hint: string;
  niches: TemplateNiche[];
  register: TemplateRegister;
  mode: TemplateMode;
  moods: TemplateMood[];
  minProducts: number;
  autoCandidate: boolean;
}

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    id: 'auto',
    label: 'Auto',
    hint: '1 produit → mono, 2+ → grille',
    niches: [],
    register: 'mass',
    mode: 'split',
    moods: ['sans'],
    minProducts: 0,
    autoCandidate: false,
  },
  {
    id: 'mono',
    label: 'Mono-produit',
    hint: 'Landing DTC long-form, 1 SKU mis en scène',
    niches: ['tech', 'home', 'beauty', 'wellness'],
    register: 'premium',
    mode: 'mono',
    moods: ['sans', 'minimal'],
    minProducts: 1,
    autoCandidate: true,
  },
  {
    id: 'collection-grid',
    label: 'Collection grille',
    hint: 'Grille 4 colonnes classique',
    niches: ['fashion', 'home', 'jewelry', 'gifting', 'kids'],
    register: 'mass',
    mode: 'collection',
    moods: ['sans', 'minimal'],
    minProducts: 4,
    autoCandidate: true,
  },
  {
    id: 'collection-editorial',
    label: 'Collection éditoriale',
    hint: '3 à 6 pièces en sections alternées, ton narratif',
    niches: ['fashion', 'beauty', 'jewelry', 'home', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'minimal'],
    minProducts: 3,
    autoCandidate: true,
  },
  {
    id: 'luxury-minimal',
    label: 'Luxury minimal',
    hint: 'Noir & blanc, typo Satoshi black, blanc généreux, photos pleine page',
    niches: ['fashion', 'jewelry', 'beauty', 'tech'],
    register: 'luxury',
    mode: 'editorial',
    moods: ['dark', 'minimal', 'sans'],
    minProducts: 1,
    autoCandidate: false,
  },
  {
    id: 'gen-z-bold',
    label: 'Gen-Z bold',
    hint: 'Couleur saturée full-bleed, gros titres, marquee, grain, motion',
    niches: ['fashion', 'beauty', 'kids', 'food', 'beverage'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'playful', 'sans'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'editorial-fashion',
    label: 'Editorial fashion',
    hint: 'Hero portrait pleine page, logotype serif, diptyque produits, grille Instagram',
    niches: ['fashion', 'editorial', 'beauty'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'cinematic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-soft',
    label: 'Wellness soft',
    hint: 'Hero photo + plates info slate-blue, Poppins light, grille 3x2, footer navy',
    niches: ['wellness', 'health', 'beauty', 'home', 'pet'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'sans', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
] as const;

export type StoreTemplate = (typeof TEMPLATE_CATALOG)[number]['id'];

export const TEMPLATE_IDS: readonly StoreTemplate[] = TEMPLATE_CATALOG.map(
  (t) => t.id as StoreTemplate,
);

export function getTemplateEntry(id: string): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((t) => t.id === id);
}

export interface ScoringContext {
  niche?: string;
  niches?: TemplateNiche[];
  register?: TemplateRegister;
  productCount: number;
  preferMono?: boolean;
}

/**
 * Score a template against a store context. Higher = better fit.
 * Used by the niche-research agent to suggest a template.
 */
export function scoreTemplate(
  entry: TemplateCatalogEntry,
  ctx: ScoringContext,
): number {
  if (entry.id === 'auto') return -1;
  if (ctx.productCount < entry.minProducts) return -5;

  let score = 0;

  if (ctx.niches?.length) {
    const overlap = entry.niches.filter((n) => ctx.niches!.includes(n)).length;
    score += overlap * 4;
  } else if (ctx.niche) {
    const niche = ctx.niche.toLowerCase();
    if (entry.niches.some((n) => niche.includes(n))) score += 4;
  }

  if (ctx.register && entry.register === ctx.register) score += 3;
  if (ctx.preferMono && entry.mode === 'mono') score += 5;
  if (ctx.productCount === 1 && entry.mode === 'mono') score += 2;
  if (ctx.productCount >= 4 && entry.mode === 'collection') score += 1;

  return score;
}

export function pickTopTemplates(
  ctx: ScoringContext,
  limit = 3,
): TemplateCatalogEntry[] {
  return TEMPLATE_CATALOG.filter((t) => t.id !== 'auto')
    .map((t) => ({ entry: t, score: scoreTemplate(t, ctx) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}
