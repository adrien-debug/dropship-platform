/**
 * Maps product names/categories to local AI-generated images.
 * Replaces external placeholder URLs (Unsplash, etc.) with local assets.
 */

const CHARACTER_KEYWORDS: Record<string, string> = {
  luffy: 'luffy',
  gear: 'luffy',
  nika: 'luffy',
  zoro: 'zoro',
  sabre: 'zoro',
  nami: 'nami',
  navigat: 'nami',
  sanji: 'sanji',
  chef: 'sanji',
  cuisinier: 'sanji',
  chopper: 'chopper',
  doctor: 'chopper',
  robin: 'robin',
  franky: 'franky',
  brook: 'brook',
  jinbe: 'jinbe',
  jimbei: 'jinbe',
  ace: 'ace',
};

const CATEGORY_TO_FOLDER: Record<string, { folder: string; prefix: string }> = {
  mugs: { folder: 'mugs', prefix: 'mug' },
  't-shirts': { folder: 'tshirts', prefix: 'tshirt' },
  figurines: { folder: 'figurines', prefix: 'fig' },
  posters: { folder: 'posters', prefix: 'poster' },
  stickers: { folder: 'stickers', prefix: 'stickers' },
  accessoires: { folder: 'casquettes', prefix: 'cap' },
  casquettes: { folder: 'casquettes', prefix: 'cap' },
  sweats: { folder: 'hoodies', prefix: 'hoodie' },
  hoodies: { folder: 'hoodies', prefix: 'hoodie' },
  peluches: { folder: 'peluches', prefix: 'plush' },
  coques: { folder: 'coques', prefix: 'case' },
  slimes: { folder: 'slimes', prefix: 'slime' },
  gourdes: { folder: 'gourdes', prefix: 'bottle' },
  puzzles: { folder: 'puzzles', prefix: 'puzzle' },
};

const FALLBACK_IMAGES: Record<string, string> = {
  mugs: '/products/mugs/mug-luffy.png',
  'tshirts': '/products/tshirts/tshirt-luffy.png',
  figurines: '/products/figurines/fig-luffy.png',
  posters: '/products/posters/poster-crew.png',
  stickers: '/products/stickers/stickers-crew.png',
  casquettes: '/products/casquettes/cap-luffy.png',
  hoodies: '/products/hoodies/hoodie-luffy.png',
  peluches: '/products/peluches/plush-luffy.png',
  coques: '/products/coques/case-luffy.png',
  slimes: '/products/slimes/slime-luffy.png',
  gourdes: '/products/gourdes/bottle-luffy.png',
  puzzles: '/products/puzzles/puzzle-luffy.png',
};

function detectCharacter(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, char] of Object.entries(CHARACTER_KEYWORDS)) {
    if (lower.includes(keyword)) return char;
  }
  return 'luffy';
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function resolveProductImage(
  imageUrl: string,
  productName: string,
  category: string,
): string {
  if (!isExternalUrl(imageUrl)) return imageUrl;

  const catKey = category.toLowerCase();
  const mapping = CATEGORY_TO_FOLDER[catKey];
  if (!mapping) {
    return FALLBACK_IMAGES[catKey] ?? '/products/mugs/mug-luffy.png';
  }

  const character = detectCharacter(productName);

  const specialCases: Record<string, string[]> = {
    stickers: ['crew', 'luffy', 'zoro'],
    posters: ['ace', 'chopper', 'crew', 'luffy', 'nami', 'sanji', 'zoro'],
    puzzles: ['ace', 'crew', 'luffy', 'nami', 'sanji', 'zoro'],
  };

  const available = specialCases[mapping.folder];
  if (available && !available.includes(character)) {
    return `/products/${mapping.folder}/${mapping.prefix}-${available[0]}.png`;
  }

  return `/products/${mapping.folder}/${mapping.prefix}-${character}.png`;
}

export function resolveProductImages(
  imageUrls: string[],
  productName: string,
  category: string,
): string[] {
  if (imageUrls.length === 0) {
    return [resolveProductImage('https://placeholder', productName, category)];
  }
  return imageUrls.map(url => resolveProductImage(url, productName, category));
}
