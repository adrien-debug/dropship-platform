import { NextResponse, type NextRequest } from 'next/server';
import { getCJClient } from '@dropship/suppliers';

const MOCK_CATEGORIES = [
  'Figurines', 'T-Shirts', 'Hoodies', 'Mugs', 'Posters', 
  'Gourdes', 'Peluches', 'Casquettes', 'Coques', 'Stickers', 'Puzzles', 'Slimes'
];

const ONE_PIECE_KEYWORDS = [
  'one piece luffy figure',
  'one piece zoro figure',
  'one piece nami figure',
  'one piece t-shirt',
  'one piece hoodie',
  'one piece mug',
  'one piece poster',
  'one piece plush',
  'anime figure',
  'anime merchandise'
];

interface CachedProducts {
  items: ProductDto[];
  timestamp: number;
}

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

let productsCache: CachedProducts | null = null;
const CACHE_TTL = 3600000; // 1 hour

async function fetchCJProducts(): Promise<ProductDto[]> {
  const cjClient = getCJClient();
  if (!cjClient) {
    console.warn('CJ Dropshipping client not configured, using demo products');
    return generateDemoProducts();
  }

  try {
    const products = await cjClient.searchProducts(ONE_PIECE_KEYWORDS, { limit: 100 });
    
    return products.map((p, idx) => {
      const category = MOCK_CATEGORIES[idx % MOCK_CATEGORIES.length];
      const priceCents = p.costCents > 0 ? Math.round(p.costCents * 2.5) : 1990;
      
      return {
        id: p.externalId || `cj-${idx}`,
        name: p.name,
        description: p.description,
        priceCents,
        category,
        inStock: true,
        imageUrls: p.imageUrls.filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('Error fetching CJ products:', error);
    console.warn('Falling back to demo products');
    return generateDemoProducts();
  }
}

function generateDemoProducts(): ProductDto[] {
  const demoProducts: ProductDto[] = [];
  const characters = ['Luffy', 'Zoro', 'Nami', 'Sanji', 'Chopper', 'Robin', 'Franky', 'Brook'];
  
  MOCK_CATEGORIES.forEach((category, catIdx) => {
    characters.forEach((character, charIdx) => {
      const id = `demo-${catIdx}-${charIdx}`;
      const basePrice = 1490 + (catIdx * 500) + (charIdx * 100);
      
      demoProducts.push({
        id,
        name: `${character} ${category} - Edition Collector`,
        description: `${category} One Piece officiel representant ${character}. Qualite premium, design exclusif.`,
        priceCents: basePrice,
        category,
        inStock: true,
        imageUrls: [`/characters/${character.toLowerCase()}.png`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  });
  
  return demoProducts;
}

async function getCachedProducts(): Promise<ProductDto[]> {
  const now = Date.now();
  
  if (productsCache && (now - productsCache.timestamp) < CACHE_TTL) {
    return productsCache.items;
  }

  const items = await fetchCJProducts();
  productsCache = { items, timestamp: now };
  
  return items;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit') ?? '20')));
  const sort = sp.get('sort') ?? 'new';
  const category = sp.get('category')?.trim() ?? '';
  const inStock = sp.get('in_stock');
  const priceMin = sp.get('price_min');
  const priceMax = sp.get('price_max');
  const q = sp.get('q')?.trim() ?? '';

  try {
    let items = await getCachedProducts();

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
      limit 
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' }, 
      { status: 500 }
    );
  }
}
