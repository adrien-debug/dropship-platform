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
  {
    id: 'luxury-mono',
    label: 'Luxury mono',
    hint: 'Mono-produit haut de gamme — Cormorant Garamond serif, palette ivoire/charbon, storytelling long, packaging signature, framing made-to-order',
    niches: ['fashion', 'jewelry', 'beauty', 'home', 'editorial', 'gifting'],
    register: 'luxury',
    mode: 'mono',
    moods: ['serif', 'minimal', 'cinematic'],
    minProducts: 1,
    autoCandidate: false,
  },
  // ============== Wix ingest batch — May 2026 ==============
  {
    id: 'wellness-serenity',
    label: 'Wellness serenity',
    hint: 'Spa apaisé, Cormorant Garamond serif teal sage, sections centrées et photos lifestyle douces.',
    niches: ['wellness', 'health', 'beauty'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-pulse',
    label: 'Wellness pulse',
    hint: 'Coach fitness énergique, Manrope navy + plate teal et accent lime hot, tuiles 3 cartes Réserver.',
    niches: ['wellness', 'health', 'sport'],
    register: 'premium',
    mode: 'split',
    moods: ['bold', 'sans', 'playful'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-dance',
    label: 'Wellness dance',
    hint: "Studio danse playful, Jockey One display italic, plates cyan peach lavender et CTA purple S'abonner.",
    niches: ['wellness', 'sport', 'kids', 'events'],
    register: 'mass',
    mode: 'editorial',
    moods: ['playful', 'bold', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-studio',
    label: 'Wellness studio',
    hint: 'Salle de sport dark, Poppins Black + triptyque photo et plate blanche centrée, accent orange chaud.',
    niches: ['wellness', 'sport', 'health'],
    register: 'mass',
    mode: 'editorial',
    moods: ['bold', 'dark', 'cinematic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-retreat',
    label: 'Wellness retreat',
    hint: 'Cormorant Garamond ExtraLight serif, hero océanique turquoise, CTA jaune signature, sub-line italique, contact form centré, footer turquoise.',
    niches: ['wellness', 'health'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'cinematic'],
    minProducts: 1,
    autoCandidate: false,
  },
  {
    id: 'wellness-fitness-blog',
    label: 'Wellness fitness blog',
    hint: 'Manrope Extrabold, soulignage lime fluo skewé, bandes catégorielles FITNESS / NUTRITION / MOTIVATION, cards photo + tuile éditoriale, footer noir.',
    niches: ['wellness', 'sport', 'health', 'editorial'],
    register: 'mass',
    mode: 'editorial',
    moods: ['bold', 'sans', 'playful'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'wellness-massage-quiet',
    label: 'Wellness massage quiet',
    hint: "Palette crème chaude + brun chocolat, Cormorant Garamond italique d'accent, liste de soins 3 zones, portrait rond Meet Your Therapist, footer cocoa profond.",
    niches: ['wellness', 'beauty', 'health'],
    register: 'premium',
    mode: 'split',
    moods: ['soft', 'serif', 'organic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'wellness-onyx-gym',
    label: 'Wellness onyx gym',
    hint: 'Onyx black + magenta signature + cyan accent, Manrope Heavy uppercase, hero plein cadre sombre, blocs alternés cyan/onyx/magenta, strip équipements, form essai gratuit.',
    niches: ['wellness', 'sport', 'health'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'dark', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-musicart',
    label: 'Events Musicart',
    hint: 'Scène concert dark avec blocs corail, Bebas Neue uppercase, liste agenda majuscule.',
    niches: ['events', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'cinematic', 'dark'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-bouquet',
    label: 'Events Bouquet',
    hint: 'Photographie romantique, serif italique Cormorant, bandeau pastel mint, pull-quote centré.',
    niches: ['events', 'gifting'],
    register: 'premium',
    mode: 'editorial',
    moods: ['soft', 'serif', 'cinematic'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'events-arcadium',
    label: 'Events Arcadium',
    hint: 'Affiche cyberpunk, JetBrains Mono techy, accent néon jaune sur slab noir, fond lavande.',
    niches: ['events', 'tech'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'dark', 'playful'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'events-summit',
    label: 'Events Summit',
    hint: 'Conference summit, Space Grotesk sur sage card avec grille pointillée, agenda slab dark + tickets jaune.',
    niches: ['events', 'editorial'],
    register: 'premium',
    mode: 'editorial',
    moods: ['bold', 'sans', 'organic'],
    minProducts: 2,
    autoCandidate: false,
  },
  {
    id: 'events-converge',
    label: 'Events Converge',
    hint: 'Webinaire marketing, cartes modulaires sur fond noir avec jaune et bleu, Manrope display.',
    niches: ['events', 'tech'],
    register: 'premium',
    mode: 'collection',
    moods: ['bold', 'playful', 'sans'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'fashion-boutique-1622',
    label: 'Fashion boutique 1622',
    hint: 'Boutique mode classique, hero serif Cormorant sur photo, header charcoal slim, grille 3 produits, footer 3 colonnes.',
    niches: ['fashion', 'editorial'],
    register: 'premium',
    mode: 'collection',
    moods: ['serif', 'minimal', 'soft'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'beauty-salon-2851',
    label: 'Beauty salon 2851',
    hint: 'Salon beauté champagne, hero serif Playfair sur fond crème, bande sombre 3 services, testimonial quote, grille looks.',
    niches: ['beauty', 'wellness'],
    register: 'premium',
    mode: 'editorial',
    moods: ['serif', 'soft', 'minimal'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'fiora-locks-wh1270',
    label: 'Fiora Locks',
    hint: 'Maison beauté luxe, Cormorant Garamond Light géant, fond crème, services en liste éditoriale numérotée, galerie portrait + 3 vignettes.',
    niches: ['beauty', 'wellness', 'editorial'],
    register: 'luxury',
    mode: 'editorial',
    moods: ['serif', 'minimal', 'cinematic'],
    minProducts: 3,
    autoCandidate: false,
  },
  {
    id: 'adventure-travel-2787',
    label: 'Adventure travel 2787',
    hint: 'Tourisme aventure montagne, Montserrat bold blanc sur hero photo cinématique, panneau noir overlay liste tours et CTA rouge, journal 3 cartes sombres.',
    niches: ['travel', 'sport'],
    register: 'mass',
    mode: 'collection',
    moods: ['bold', 'cinematic', 'dark'],
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

/**
 * True when the template's register is 'luxury' — used by the asset
 * generator and landing-writer to switch to luxury prompts / voice instead
 * of the default DTC defaults. Unknown ids return false so the system
 * stays in the standard mode by default.
 */
export function isLuxuryTemplate(id: string | null | undefined): boolean {
  if (!id) return false;
  const entry = TEMPLATE_CATALOG.find((t) => t.id === id);
  return entry?.register === 'luxury';
}

