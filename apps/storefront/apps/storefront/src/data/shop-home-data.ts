export type ShopProduct = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  imageSrc: string;
  imageAlt: string;
};

export const FEATURED_PRODUCTS: readonly ShopProduct[] = [
  {
    id: 'feat-1',
    name: 'Straw Hat Jolly Roger Mug',
    priceCents: 1899,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-mug1/640/640',
    imageAlt: 'Ceramic mug with pirate emblem',
  },
  {
    id: 'feat-2',
    name: 'Wanted Poster Tee',
    priceCents: 3499,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-tee1/640/640',
    imageAlt: 'T-shirt with vintage poster graphic',
  },
  {
    id: 'feat-3',
    name: 'Captain Figure (Limited)',
    priceCents: 8999,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-fig1/640/640',
    imageAlt: 'Collectible figure on stand',
  },
  {
    id: 'feat-4',
    name: 'Grand Line Compass',
    priceCents: 2499,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-acc1/640/640',
    imageAlt: 'Brass style compass accessory',
  },
  {
    id: 'feat-5',
    name: 'Crew Bandana',
    priceCents: 1599,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-acc2/640/640',
    imageAlt: 'Printed cotton bandana',
  },
  {
    id: 'feat-6',
    name: 'Treasure Map Poster',
    priceCents: 1299,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-poster1/640/640',
    imageAlt: 'Rolled wall poster',
  },
  {
    id: 'feat-7',
    name: 'Den Den Mushi Keychain',
    priceCents: 999,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-key1/640/640',
    imageAlt: 'Metal keychain charm',
  },
  {
    id: 'feat-8',
    name: 'Log Pose Desk Clock',
    priceCents: 4299,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-clock1/640/640',
    imageAlt: 'Desk clock inspired by a navigator tool',
  },
];

export const NEW_ARRIVALS: readonly ShopProduct[] = [
  {
    id: 'new-1',
    name: 'Sea Chart Hoodie',
    priceCents: 5999,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-new1/640/640',
    imageAlt: 'Hoodie with nautical chart print',
  },
  {
    id: 'new-2',
    name: 'Pirate King Cap',
    priceCents: 2799,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-new2/640/640',
    imageAlt: 'Structured cap with embroidered logo',
  },
  {
    id: 'new-3',
    name: 'Sake Cup Set (2)',
    priceCents: 3299,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-new3/640/640',
    imageAlt: 'Two ceramic cups in a gift box',
  },
  {
    id: 'new-4',
    name: 'Shipwright Tool Pin Set',
    priceCents: 1499,
    currency: 'EUR',
    imageSrc: 'https://picsum.photos/seed/onepeace-new4/640/640',
    imageAlt: 'Enamel pins on card backing',
  },
];

export type ShopCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
};

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  {
    id: 'mugs',
    title: 'Mugs',
    description: 'Start the voyage with your morning brew.',
    href: '#mugs',
    imageSrc: 'https://picsum.photos/seed/onepeace-cat-mugs/800/600',
    imageAlt: 'Stack of branded mugs',
  },
  {
    id: 'tshirts',
    title: 'T-Shirts',
    description: 'Bold prints, soft cotton, crew-approved fits.',
    href: '#tshirts',
    imageSrc: 'https://picsum.photos/seed/onepeace-cat-tees/800/600',
    imageAlt: 'Folded graphic t-shirts',
  },
  {
    id: 'figures',
    title: 'Figures',
    description: 'Detailed collectibles for your display shelf.',
    href: '#figures',
    imageSrc: 'https://picsum.photos/seed/onepeace-cat-figures/800/600',
    imageAlt: 'Collectible figures on a shelf',
  },
  {
    id: 'accessories',
    title: 'Accessories',
    description: 'Pins, straps, and everyday essentials.',
    href: '#accessories',
    imageSrc: 'https://picsum.photos/seed/onepeace-cat-acc/800/600',
    imageAlt: 'Assorted accessories flat lay',
  },
];
