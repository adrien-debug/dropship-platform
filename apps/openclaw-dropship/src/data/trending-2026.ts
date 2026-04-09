export interface TrendSeed {
  name: string;
  keywords: string[];
  category: string;
  costRange: { min: number; max: number };
  retailRange: { min: number; max: number };
  marginPct: number;
  searchTrend: 'rising' | 'hot' | 'stable';
  trendNote: string;
}

export const TRENDING_PRODUCTS_2026: TrendSeed[] = [
  // --- At-Home Wellness (30-65% margins) ---
  { name: 'Red Light Therapy Face Mask', keywords: ['red light', 'therapy', 'face mask', 'led mask', 'skincare device'], category: 'wellness', costRange: { min: 1800, max: 2500 }, retailRange: { min: 5900, max: 8900 }, marginPct: 60, searchTrend: 'hot', trendNote: 'Replaces $150 spa treatments' },
  { name: 'Posture Corrector Smart Vibration', keywords: ['posture', 'corrector', 'back support', 'vibration', 'ergonomic'], category: 'wellness', costRange: { min: 800, max: 1200 }, retailRange: { min: 3400, max: 4900 }, marginPct: 65, searchTrend: 'hot', trendNote: 'Remote work ergonomics crisis' },
  { name: 'Acupressure Mat Set', keywords: ['acupressure', 'mat', 'massage', 'pain relief', 'relaxation'], category: 'wellness', costRange: { min: 1200, max: 1800 }, retailRange: { min: 4500, max: 6500 }, marginPct: 60, searchTrend: 'rising', trendNote: 'Search +180% since Q3 2025' },
  { name: 'Gua Sha Stone Set', keywords: ['gua sha', 'jade', 'rose quartz', 'facial tool', 'skincare'], category: 'wellness', costRange: { min: 300, max: 600 }, retailRange: { min: 2200, max: 3500 }, marginPct: 75, searchTrend: 'stable', trendNote: 'Lightweight, high perceived value' },
  { name: 'Eye Massage Mask Heat Vibration', keywords: ['eye massage', 'eye mask', 'heat', 'vibration', 'fatigue'], category: 'wellness', costRange: { min: 1400, max: 2000 }, retailRange: { min: 4900, max: 6900 }, marginPct: 55, searchTrend: 'rising', trendNote: 'Screen fatigue epidemic — gamers, programmers' },
  { name: 'Scalp Massager Electric', keywords: ['scalp massager', 'head massage', 'electric', 'hair growth'], category: 'wellness', costRange: { min: 600, max: 1000 }, retailRange: { min: 2400, max: 3900 }, marginPct: 70, searchTrend: 'hot', trendNote: 'ASMR content drives virality' },
  { name: 'Lymphatic Drainage Massager', keywords: ['lymphatic', 'drainage', 'massager', 'body massage'], category: 'wellness', costRange: { min: 800, max: 1400 }, retailRange: { min: 3200, max: 4800 }, marginPct: 65, searchTrend: 'rising', trendNote: 'Inflammation reduction trend' },

  // --- Emotional Support Home Decor (40-65% margins) ---
  { name: 'Weighted Dinosaur Plushie', keywords: ['weighted', 'dinosaur', 'plushie', 'anxiety', 'stuffed animal'], category: 'home decor', costRange: { min: 800, max: 1300 }, retailRange: { min: 3200, max: 4800 }, marginPct: 65, searchTrend: 'hot', trendNote: '300% search spike Oct 2025' },
  { name: 'Galaxy Projector App Controlled', keywords: ['galaxy', 'projector', 'star', 'night light', 'room decor'], category: 'home decor', costRange: { min: 1500, max: 2200 }, retailRange: { min: 4900, max: 7500 }, marginPct: 57, searchTrend: 'stable', trendNote: 'Room transformation videos' },
  { name: 'Sunset Lamp Color Changing', keywords: ['sunset', 'lamp', 'mood light', 'color changing', 'aesthetic'], category: 'home decor', costRange: { min: 1200, max: 1800 }, retailRange: { min: 3900, max: 5900 }, marginPct: 60, searchTrend: 'stable', trendNote: 'Instagram aesthetic' },
  { name: 'Flame Effect Oil Diffuser', keywords: ['flame', 'diffuser', 'essential oil', 'aromatherapy', 'humidifier'], category: 'home decor', costRange: { min: 1600, max: 2400 }, retailRange: { min: 5500, max: 7900 }, marginPct: 55, searchTrend: 'rising', trendNote: 'Multi-sensory + consumable tie-in' },

  // --- Consumables / Repeat Revenue (30-50% margins) ---
  { name: 'Silicone Air Fryer Liner', keywords: ['air fryer', 'liner', 'silicone', 'reusable', 'baking mat'], category: 'kitchen', costRange: { min: 300, max: 600 }, retailRange: { min: 1600, max: 2400 }, marginPct: 65, searchTrend: 'hot', trendNote: 'Repeat purchases — needs replacement' },
  { name: 'Oil Sprayer Mist Bottle', keywords: ['oil sprayer', 'mist', 'cooking spray', 'olive oil', 'air fryer'], category: 'kitchen', costRange: { min: 400, max: 700 }, retailRange: { min: 1800, max: 2800 }, marginPct: 70, searchTrend: 'rising', trendNote: 'Health cooking + air fryer pairing' },
  { name: 'Multi Blade Vegetable Chopper', keywords: ['vegetable chopper', 'dicer', 'food prep', 'kitchen gadget'], category: 'kitchen', costRange: { min: 800, max: 1300 }, retailRange: { min: 2900, max: 4500 }, marginPct: 60, searchTrend: 'stable', trendNote: 'Satisfying demo videos' },

  // --- Fitness / Active (40-65% margins) ---
  { name: 'Smart Jump Rope Counter', keywords: ['jump rope', 'smart', 'counter', 'fitness', 'cardio'], category: 'fitness', costRange: { min: 900, max: 1400 }, retailRange: { min: 3200, max: 4900 }, marginPct: 62, searchTrend: 'rising', trendNote: 'Gamification + minimal space' },
  { name: 'Resistance Bands Set', keywords: ['resistance band', 'exercise band', 'fitness', 'workout', 'gym'], category: 'fitness', costRange: { min: 500, max: 900 }, retailRange: { min: 2200, max: 3500 }, marginPct: 65, searchTrend: 'stable', trendNote: 'Needs replacement, repeat buyer' },
  { name: 'Cooling Towel Sport', keywords: ['cooling towel', 'sport', 'ice towel', 'outdoor', 'gym'], category: 'fitness', costRange: { min: 300, max: 600 }, retailRange: { min: 1500, max: 2400 }, marginPct: 72, searchTrend: 'rising', trendNote: 'Seasonal peak May-Aug' },

  // --- Car Accessories (35-60% margins) ---
  { name: 'Magnetic Phone Mount Car', keywords: ['phone mount', 'car', 'magnetic', 'dashboard', 'holder'], category: 'car accessories', costRange: { min: 400, max: 700 }, retailRange: { min: 1800, max: 2900 }, marginPct: 68, searchTrend: 'stable', trendNote: 'Universal need, distracted driving prevention' },
  { name: 'LED Car Interior Ambient Lights', keywords: ['car led', 'interior light', 'ambient', 'strip light', 'rgb'], category: 'car accessories', costRange: { min: 600, max: 1000 }, retailRange: { min: 2400, max: 3900 }, marginPct: 65, searchTrend: 'stable', trendNote: 'Before/after transformation content' },

  // --- Pet Products (40-70% margins) ---
  { name: 'Slow Feeder Dog Bowl', keywords: ['slow feeder', 'dog bowl', 'puzzle', 'pet feeder', 'anti-choke'], category: 'pet', costRange: { min: 500, max: 900 }, retailRange: { min: 2200, max: 3500 }, marginPct: 65, searchTrend: 'stable', trendNote: 'Vet-recommended, prevents bloat' },
  { name: 'Pet Hair Remover Reusable', keywords: ['pet hair', 'remover', 'lint roller', 'reusable', 'cat dog'], category: 'pet', costRange: { min: 400, max: 700 }, retailRange: { min: 1800, max: 2900 }, marginPct: 70, searchTrend: 'rising', trendNote: 'No consumables needed, solves frustration' },
  { name: 'Pet Water Fountain Filtered', keywords: ['pet fountain', 'water', 'filter', 'cat fountain', 'dog water'], category: 'pet', costRange: { min: 1400, max: 2200 }, retailRange: { min: 4500, max: 6900 }, marginPct: 55, searchTrend: 'stable', trendNote: 'Repeat revenue via filter replacements' },
];

export function matchTrendSeeds(niche: string): { matched: TrendSeed[]; boostKeywords: string[] } {
  const nicheWords = niche.toLowerCase().split(/\s+/);
  const matched: TrendSeed[] = [];
  const boostKeywords: string[] = [];

  for (const seed of TRENDING_PRODUCTS_2026) {
    const catMatch = nicheWords.some(w => seed.category.includes(w));
    const kwMatch = seed.keywords.some(kw =>
      nicheWords.some(w => kw.includes(w) || w.includes(kw.split(' ')[0]!)),
    );
    if (catMatch || kwMatch) {
      matched.push(seed);
      boostKeywords.push(...seed.keywords.slice(0, 2));
    }
  }

  if (matched.length === 0) {
    const hot = TRENDING_PRODUCTS_2026.filter(s => s.searchTrend === 'hot');
    matched.push(...hot.slice(0, 5));
    boostKeywords.push(...hot.flatMap(s => s.keywords.slice(0, 2)));
  }

  return { matched, boostKeywords: [...new Set(boostKeywords)] };
}
