import { NextResponse, type NextRequest } from 'next/server';
import { ALIEXPRESS_CATALOG } from '@/data/aliexpress-catalog';

const CATEGORIES = [
  'Figurines', 'Figurines Luffy Gear 5', 'Figurines Shanks', 'Figurines Ace',
  'Figurines Sanji', 'Figurines Nami Robin Hancock', 'Figurines Law', 'Figurines Chopper',
  'T-Shirts', 'Hoodies', 'Vestes Bombers', 'Sneakers', 'Cosplay', 'Chaussettes', 'Casquettes',
  'Mugs', 'Gourdes', 'Coques iPhone', 'Coques AirPods',
  'Porte-cl\u00e9s', 'Posters', 'Sacs', 'Peluches', 'Bijoux',
  'Lampes LED', 'Portefeuilles', 'Stickers', 'Tapis de souris',
  'Couvertures', 'Puzzles', 'Mini Figures', 'Building Blocks',
  'Fruits du Demon', 'Maquettes Bateaux', 'Montres', 'Drapeaux',
  'Cartes TCG', 'Rideaux Tapisseries', 'Goodies', 'Bureau', 'Maison',
];

interface ProductDto {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  inStock: boolean;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

interface CachedProducts {
  items: ProductDto[];
  timestamp: number;
}

let productsCache: CachedProducts | null = null;
const CACHE_TTL = 3600000;

function getProducts(): ProductDto[] {
  const now = Date.now();
  if (productsCache && (now - productsCache.timestamp) < CACHE_TTL) {
    return productsCache.items;
  }

  const items: ProductDto[] = ALIEXPRESS_CATALOG.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    category: p.category,
    inStock: p.inStock,
    imageUrls: p.imageUrls,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  productsCache = { items, timestamp: now };
  return items;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const limit = Math.min(1000, Math.max(1, Number(sp.get('limit') ?? '24')));
  const sort = sp.get('sort') ?? 'new';
  const category = sp.get('category')?.trim() ?? '';
  const inStock = sp.get('in_stock');
  const priceMin = sp.get('price_min');
  const priceMax = sp.get('price_max');
  const q = sp.get('q')?.trim() ?? '';

  try {
    let items = [...getProducts()];

    if (category) {
      items = items.filter(p => p.category === category);
    }

    if (inStock === 'true') {
      items = items.filter(p => p.inStock);
    } else if (inStock === 'false') {
      items = items.filter(p => !p.inStock);
    }

    if (priceMin) {
      items = items.filter(p => p.priceCents >= Number(priceMin));
    }

    if (priceMax) {
      items = items.filter(p => p.priceCents <= Number(priceMax));
    }

    if (q) {
      const query = q.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    if (sort === 'price_asc') {
      items.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sort === 'price_desc') {
      items.sort((a, b) => b.priceCents - a.priceCents);
    } else if (sort === 'random') {
      items.sort(() => Math.random() - 0.5);
    }

    const total = items.length;
    const offset = (page - 1) * limit;
    const paginatedItems = items.slice(offset, offset + limit);

    return NextResponse.json({
      items: paginatedItems,
      total,
      page,
      limit,
      categories: CATEGORIES,
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
