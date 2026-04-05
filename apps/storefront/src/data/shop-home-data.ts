import { ALIEXPRESS_CATALOG } from './aliexpress-catalog';

export type ShopProduct = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  imageSrc: string;
  imageAlt: string;
};

const hasImage = (p: (typeof ALIEXPRESS_CATALOG)[number]) => !!p.imageUrls[0];

function toShopProduct(p: (typeof ALIEXPRESS_CATALOG)[number]): ShopProduct {
  return {
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    currency: 'EUR',
    imageSrc: p.imageUrls[0] || '',
    imageAlt: p.name,
  };
}

export const FEATURED_PRODUCTS: readonly ShopProduct[] = [
  ...ALIEXPRESS_CATALOG.filter(p => p.category === 'Figurines' && hasImage(p)).slice(0, 4).map(toShopProduct),
  ...ALIEXPRESS_CATALOG.filter(p => p.category === 'T-Shirts' && hasImage(p)).slice(0, 2).map(toShopProduct),
  ...ALIEXPRESS_CATALOG.filter(p => p.category === 'Hoodies' && hasImage(p)).slice(0, 2).map(toShopProduct),
];

export const NEW_ARRIVALS: readonly ShopProduct[] = [
  ...ALIEXPRESS_CATALOG.filter(p => p.priceCents >= 5000 && hasImage(p)).slice(0, 4).map(toShopProduct),
];

export type ShopCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
};

function categoryImage(cat: string): string {
  const p = ALIEXPRESS_CATALOG.find(x => x.category === cat && x.imageUrls[0]);
  return p?.imageUrls[0] ?? '';
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  { id: 'figurines', title: 'Figurines', description: 'Figurines PVC collector, de 12cm a 55cm.', href: '/shop?category=Figurines', imageSrc: categoryImage('Figurines'), imageAlt: 'Figurines One Piece' },
  { id: 'gear5', title: 'Figurines Luffy Gear 5', description: 'Nika, Sun God, Joyboy - les plus demandees.', href: '/shop?category=Figurines Luffy Gear 5', imageSrc: categoryImage('Figurines Luffy Gear 5'), imageAlt: 'Luffy Gear 5' },
  { id: 'shanks', title: 'Figurines Shanks', description: 'Le Roux, Yonko, empereur des mers.', href: '/shop?category=Figurines Shanks', imageSrc: categoryImage('Figurines Shanks'), imageAlt: 'Shanks' },
  { id: 'ace', title: 'Figurines Ace', description: 'Portgas D. Ace, Fire Fist, flammes eternelles.', href: '/shop?category=Figurines Ace', imageSrc: categoryImage('Figurines Ace'), imageAlt: 'Ace' },
  { id: 'sanji', title: 'Figurines Sanji', description: 'Vinsmoke Sanji, Black Leg, cuisinier.', href: '/shop?category=Figurines Sanji', imageSrc: categoryImage('Figurines Sanji'), imageAlt: 'Sanji' },
  { id: 'nami-robin', title: 'Figurines Nami/Robin/Hancock', description: 'Heroines One Piece, collector premium.', href: '/shop?category=Figurines Nami Robin Hancock', imageSrc: categoryImage('Figurines Nami Robin Hancock'), imageAlt: 'Nami Robin Hancock' },
  { id: 'law', title: 'Figurines Law', description: 'Trafalgar D. Water Law, chirurgien de la mort.', href: '/shop?category=Figurines Law', imageSrc: categoryImage('Figurines Law'), imageAlt: 'Law' },
  { id: 'chopper', title: 'Figurines Chopper', description: 'Tony Tony Chopper, kawaii et mignon.', href: '/shop?category=Figurines Chopper', imageSrc: categoryImage('Figurines Chopper'), imageAlt: 'Chopper' },
  { id: 'tshirts', title: 'T-Shirts', description: 'Coton premium, prints anime.', href: '/shop?category=T-Shirts', imageSrc: categoryImage('T-Shirts'), imageAlt: 'T-shirts One Piece' },
  { id: 'hoodies', title: 'Hoodies', description: 'Streetwear Y2K, pullovers chauds.', href: '/shop?category=Hoodies', imageSrc: categoryImage('Hoodies'), imageAlt: 'Hoodies One Piece' },
  { id: 'vestes', title: 'Vestes Bombers', description: 'Bombers, baseball jackets, windbreakers.', href: '/shop?category=Vestes Bombers', imageSrc: categoryImage('Vestes Bombers'), imageAlt: 'Vestes One Piece' },
  { id: 'sneakers', title: 'Sneakers', description: 'Canvas, basketball et high-top anime.', href: '/shop?category=Sneakers', imageSrc: categoryImage('Sneakers'), imageAlt: 'Sneakers One Piece' },
  { id: 'cosplay', title: 'Cosplay', description: 'Costumes, epees et accessoires cosplay.', href: '/shop?category=Cosplay', imageSrc: categoryImage('Cosplay'), imageAlt: 'Cosplay One Piece' },
  { id: 'casquettes', title: 'Casquettes', description: 'Casquettes, straw hats et bucket hats.', href: '/shop?category=Casquettes', imageSrc: categoryImage('Casquettes'), imageAlt: 'Casquettes One Piece' },
  { id: 'chaussettes', title: 'Chaussettes', description: 'Chaussettes coton fun avec motifs OP.', href: '/shop?category=Chaussettes', imageSrc: categoryImage('Chaussettes'), imageAlt: 'Chaussettes One Piece' },
  { id: 'mugs', title: 'Mugs', description: 'Tasses et mugs ceramique One Piece.', href: '/shop?category=Mugs', imageSrc: categoryImage('Mugs'), imageAlt: 'Mugs One Piece' },
  { id: 'gourdes', title: 'Gourdes', description: 'Bouteilles, thermos inox et cups.', href: '/shop?category=Gourdes', imageSrc: categoryImage('Gourdes'), imageAlt: 'Gourdes One Piece' },
  { id: 'coques', title: 'Coques iPhone', description: 'Coques silicone et rigides pour iPhone.', href: '/shop?category=Coques iPhone', imageSrc: categoryImage('Coques iPhone'), imageAlt: 'Coques iPhone One Piece' },
  { id: 'airpods', title: 'Coques AirPods', description: 'Cases AirPods 1/2/3/Pro, Devil Fruit 3D.', href: '/shop?category=Coques AirPods', imageSrc: categoryImage('Coques AirPods'), imageAlt: 'Coques AirPods One Piece' },
  { id: 'portecles', title: 'Porte-cles', description: 'Porte-cles metal, acrylique et peluche.', href: '/shop?category=Porte-cl%C3%A9s', imageSrc: categoryImage('Porte-cl\u00e9s'), imageAlt: 'Porte-cles One Piece' },
  { id: 'posters', title: 'Posters', description: 'Posters canvas et kraft style Wanted.', href: '/shop?category=Posters', imageSrc: categoryImage('Posters'), imageAlt: 'Posters One Piece' },
  { id: 'sacs', title: 'Sacs', description: 'Sacs a dos, bandoulieres et crossbody.', href: '/shop?category=Sacs', imageSrc: categoryImage('Sacs'), imageAlt: 'Sacs One Piece' },
  { id: 'peluches', title: 'Peluches', description: 'Peluches Chopper, Luffy et compagnie.', href: '/shop?category=Peluches', imageSrc: categoryImage('Peluches'), imageAlt: 'Peluches One Piece' },
  { id: 'bijoux', title: 'Bijoux', description: 'Colliers, bracelets et bagues anime.', href: '/shop?category=Bijoux', imageSrc: categoryImage('Bijoux'), imageAlt: 'Bijoux One Piece' },
  { id: 'lampes', title: 'Lampes LED', description: 'Lampes 3D, veilleuses et neon LED.', href: '/shop?category=Lampes LED', imageSrc: categoryImage('Lampes LED'), imageAlt: 'Lampes LED One Piece' },
  { id: 'portefeuilles', title: 'Portefeuilles', description: 'Portefeuilles PU avec designs One Piece.', href: '/shop?category=Portefeuilles', imageSrc: categoryImage('Portefeuilles'), imageAlt: 'Portefeuilles One Piece' },
  { id: 'stickers', title: 'Stickers', description: 'Stickers vinyle waterproof pour laptop/voiture.', href: '/shop?category=Stickers', imageSrc: categoryImage('Stickers'), imageAlt: 'Stickers One Piece' },
  { id: 'mousepads', title: 'Tapis de souris', description: 'Tapis XXL gaming et bureau desk mats.', href: '/shop?category=Tapis de souris', imageSrc: categoryImage('Tapis de souris'), imageAlt: 'Tapis de souris One Piece' },
  { id: 'couvertures', title: 'Couvertures', description: 'Plaids polaire, parures de lit anime.', href: '/shop?category=Couvertures', imageSrc: categoryImage('Couvertures'), imageAlt: 'Couvertures One Piece' },
  { id: 'puzzles', title: 'Puzzles', description: 'Puzzles 500-1000 pieces Wanted & crew.', href: '/shop?category=Puzzles', imageSrc: categoryImage('Puzzles'), imageAlt: 'Puzzles One Piece' },
  { id: 'minifigures', title: 'Mini Figures', description: 'Blind box, WCF et figurines chibi.', href: '/shop?category=Mini Figures', imageSrc: categoryImage('Mini Figures'), imageAlt: 'Mini Figures One Piece' },
  { id: 'blocks', title: 'Building Blocks', description: 'Briques LEGO-style, Thousand Sunny, Going Merry.', href: '/shop?category=Building Blocks', imageSrc: categoryImage('Building Blocks'), imageAlt: 'Building Blocks One Piece' },
  { id: 'fruits', title: 'Fruits du Demon', description: 'Repliques Gomu Gomu, Mera Mera, Op-Op.', href: '/shop?category=Fruits du Demon', imageSrc: categoryImage('Fruits du Demon'), imageAlt: 'Fruits du Demon' },
  { id: 'bateaux', title: 'Maquettes Bateaux', description: 'Maquettes Going Merry, Thousand Sunny, Oro Jackson.', href: '/shop?category=Maquettes Bateaux', imageSrc: categoryImage('Maquettes Bateaux'), imageAlt: 'Maquettes bateaux One Piece' },
  { id: 'montres', title: 'Montres', description: 'Montres, bracelets Apple Watch, reveils.', href: '/shop?category=Montres', imageSrc: categoryImage('Montres'), imageAlt: 'Montres One Piece' },
  { id: 'drapeaux', title: 'Drapeaux', description: 'Jolly Roger, banniere pirate, deco murale.', href: '/shop?category=Drapeaux', imageSrc: categoryImage('Drapeaux'), imageAlt: 'Drapeaux One Piece' },
  { id: 'cartes', title: 'Cartes TCG', description: 'OPCG Bandai, boosters, cartes collector.', href: '/shop?category=Cartes TCG', imageSrc: categoryImage('Cartes TCG'), imageAlt: 'Cartes TCG One Piece' },
  { id: 'rideaux', title: 'Rideaux & Tapisseries', description: 'Rideaux douche, noren, tapisseries murales.', href: '/shop?category=Rideaux Tapisseries', imageSrc: categoryImage('Rideaux Tapisseries'), imageAlt: 'Rideaux One Piece' },
  { id: 'goodies', title: 'Goodies', description: 'Accessoires et merch divers One Piece.', href: '/shop?category=Goodies', imageSrc: categoryImage('Goodies'), imageAlt: 'Goodies One Piece' },
  { id: 'bureau', title: 'Bureau', description: 'Accessoires bureau et papeterie anime.', href: '/shop?category=Bureau', imageSrc: categoryImage('Bureau'), imageAlt: 'Bureau One Piece' },
  { id: 'maison', title: 'Maison', description: 'Deco interieure, coussins et objets anime.', href: '/shop?category=Maison', imageSrc: categoryImage('Maison'), imageAlt: 'Maison One Piece' },
];
