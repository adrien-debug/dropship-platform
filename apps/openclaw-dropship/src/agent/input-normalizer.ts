/**
 * Input normalization for product search and pipeline parameters
 * Handles user phrases, typos, market/positioning variants
 */

// FR → EN keyword translations
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  montres: 'watches', montre: 'watch', homme: 'men', hommes: 'men', femme: 'women', femmes: 'women',
  sacs: 'bags', sac: 'bag', chaussures: 'shoes', chausure: 'shoes', vetements: 'clothing',
  bijoux: 'jewelry', lunettes: 'sunglasses', accessoires: 'accessories',
  sport: 'sports', cuisine: 'kitchen', maison: 'home', jardin: 'garden',
  enfant: 'kids', enfants: 'kids', bebe: 'baby', beaute: 'beauty', electronique: 'electronics',
  telephone: 'phone', ordinateur: 'computer', jouets: 'toys', animaux: 'pets',
  luxe: 'luxury', mode: 'fashion', tech: 'tech', fitness: 'fitness',
  gaming: 'gaming', jeux: 'games', video: 'video', musique: 'music',
};

// Common filler words to remove
const FILLER_WORDS = new Set([
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'au',
  'veux', 'veut', 'vendre', 'acheter', 'cherche', 'recherche',
  'jveu', 'jveux', 'chui', 'jsuis', 'jai', 'tai', 'ya',
  'hey', 'yo', 'salut', 'bonjour', 'trucs', 'chose', 'machins',
  'pour', 'avec', 'sans', 'dans', 'sur', 'sous', 'par',
  'i', 'want', 'to', 'sell', 'buy', 'looking', 'for', 'some',
  'the', 'a', 'an', 'and', 'or', 'but', 'with', 'without',
]);

// Market normalization
const MARKET_MAP: Record<string, 'FR' | 'EU' | 'US'> = {
  fr: 'FR', france: 'FR', french: 'FR', français: 'FR', francais: 'FR',
  eu: 'EU', europe: 'EU', european: 'EU', européen: 'EU', europeen: 'EU',
  us: 'US', usa: 'US', 'united states': 'US', america: 'US', american: 'US', américain: 'US', americain: 'US',
};

// Positioning normalization
const POSITIONING_MAP: Record<string, 'budget' | 'mid' | 'premium'> = {
  budget: 'budget', 'pas cher': 'budget', cheap: 'budget', entry: 'budget', 'entrée de gamme': 'budget', 'entree de gamme': 'budget', low: 'budget',
  mid: 'mid', milieu: 'mid', 'milieu de gamme': 'mid', standard: 'mid', medium: 'mid', moyen: 'mid',
  premium: 'premium', luxe: 'premium', luxury: 'premium', 'haut de gamme': 'premium', high: 'premium', 'high-end': 'premium', upscale: 'premium',
};

/**
 * Normalize a single keyword or phrase into clean English keywords
 */
export function normalizeKeywords(input: string | string[]): string[] {
  const inputs = Array.isArray(input) ? input : [input];
  const allKeywords: string[] = [];

  for (const raw of inputs) {
    const cleaned = raw
      .toLowerCase()
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^\w\s-]/g, ' ') // keep only alphanumeric, spaces, hyphens
      .replace(/\s+/g, ' ');

    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    
    // Filter out filler words
    const meaningful = words.filter(w => !FILLER_WORDS.has(w));
    
    // Translate FR → EN
    const translated = meaningful.map(w => KEYWORD_TRANSLATIONS[w] ?? w);
    
    // Deduplicate
    const unique = [...new Set(translated)];
    
    allKeywords.push(...unique);
  }

  // Final deduplication across all inputs
  const finalKeywords = [...new Set(allKeywords)].filter(k => k.length > 0);
  
  return finalKeywords;
}

export type NormalizedValue<T> = 
  | { provided: false; value: undefined }
  | { provided: true; valid: true; value: T }
  | { provided: true; valid: false; value: undefined; input: string };

/**
 * Normalize market parameter with explicit absent/invalid distinction
 */
export function normalizeMarket(input?: string): NormalizedValue<'FR' | 'EU' | 'US'> {
  if (!input) {
    return { provided: false, value: undefined };
  }
  
  const cleaned = input.toLowerCase().trim();
  const normalized = MARKET_MAP[cleaned];
  
  if (normalized) {
    return { provided: true, valid: true, value: normalized };
  }
  
  return { provided: true, valid: false, value: undefined, input };
}

/**
 * Normalize positioning parameter with explicit absent/invalid distinction
 */
export function normalizePositioning(input?: string): NormalizedValue<'budget' | 'mid' | 'premium'> {
  if (!input) {
    return { provided: false, value: undefined };
  }
  
  const cleaned = input.toLowerCase().trim();
  const normalized = POSITIONING_MAP[cleaned];
  
  if (normalized) {
    return { provided: true, valid: true, value: normalized };
  }
  
  return { provided: true, valid: false, value: undefined, input };
}

/**
 * Normalize full pipeline input with logging and validation
 * Throws error if invalid values are provided explicitly
 */
export function normalizePipelineInput(input: {
  keywords: string[];
  market?: string;
  positioning?: string;
}): {
  keywords: string[];
  market: 'FR' | 'EU' | 'US';
  positioning: 'budget' | 'mid' | 'premium';
} {
  const normalizedKeywords = normalizeKeywords(input.keywords);
  const marketResult = normalizeMarket(input.market);
  const positioningResult = normalizePositioning(input.positioning);

  // Check for invalid explicit values
  if (marketResult.provided && !marketResult.valid) {
    throw new Error(`Invalid market value: "${marketResult.input}". Valid values: FR, EU, US, france, europe, usa, etc.`);
  }
  
  if (positioningResult.provided && !positioningResult.valid) {
    throw new Error(`Invalid positioning value: "${positioningResult.input}". Valid values: budget, mid, premium, luxe, pas cher, etc.`);
  }

  // Apply defaults only for absent values
  const finalMarket = marketResult.value ?? 'FR';
  const finalPositioning = positioningResult.value ?? 'mid';

  console.log('[input-normalizer] Raw input:', {
    keywords: input.keywords,
    market: input.market,
    positioning: input.positioning,
  });
  console.log('[input-normalizer] Normalized:', {
    keywords: normalizedKeywords,
    market: finalMarket,
    positioning: finalPositioning,
  });

  return {
    keywords: normalizedKeywords,
    market: finalMarket,
    positioning: finalPositioning,
  };
}
