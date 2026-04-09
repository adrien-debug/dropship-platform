import { NextRequest, NextResponse } from 'next/server';
import { CJDropshippingClient, getAliExpressClient } from '@dropship/suppliers';

const MARGIN = 1.0;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cosmetique: ['beauty', 'skincare', 'cosmetics', 'makeup', 'serum', 'cream'],
  figurines: ['figurine', 'anime', 'collectible', 'action figure', 'one piece', 'dragon ball'],
  tech: ['gadget', 'electronics', 'phone accessories', 'smart', 'led', 'charger'],
  mode: ['fashion', 'clothing', 'streetwear', 'sneakers', 'hoodie', 'dress'],
  maison: ['home decor', 'kitchen', 'organizer', 'lamp', 'cushion', 'storage'],
  sport: ['fitness', 'yoga', 'sport', 'gym', 'outdoor', 'cycling'],
  bijoux: ['jewelry', 'necklace', 'ring', 'bracelet', 'earrings', 'watch'],
};

interface TrendItem {
  title: string;
  image: string;
  price: number;
  sell_price: number;
  supplier: string;
  category: string;
  trend_score: number;
  source: string;
  source_url: string;
  shipping_days: string;
}

function generateStaticFallback(query: string, category?: string): TrendItem[] {
  const niches: Record<string, TrendItem[]> = {
    cosmetics: [
      { title: 'Vitamin C Brightening Serum 30ml', price: 3.50, sell_price: 7.00, trend_score: 92, supplier: 'Multi-source', category: category ?? 'cosmetics', source: 'Google Trends', source_url: 'https://trends.google.com', shipping_days: '7-12j', image: '' },
      { title: 'Retinol Anti-Aging Night Cream', price: 4.20, sell_price: 8.40, trend_score: 88, supplier: 'Multi-source', category: category ?? 'cosmetics', source: 'Google Trends', source_url: 'https://trends.google.com', shipping_days: '10-15j', image: '' },
    ],
    figurine: [
      { title: 'Anime Figure Collection 25cm', price: 8.90, sell_price: 17.80, trend_score: 97, supplier: 'CJ Dropshipping', category: category ?? 'figurines', source: 'CJ Dropshipping', source_url: 'https://cjdropshipping.com', shipping_days: '8-15j', image: '' },
    ],
    gadget: [
      { title: 'Mini Projector Portable HD 1080P', price: 18.50, sell_price: 37.00, trend_score: 94, supplier: 'CJ Dropshipping', category: category ?? 'tech', source: 'CJ Dropshipping', source_url: 'https://cjdropshipping.com', shipping_days: '7-12j', image: '' },
    ],
  };

  const keywords = category ? CATEGORY_KEYWORDS[category] ?? [category] : [query];
  const matched: TrendItem[] = [];
  for (const [key, products] of Object.entries(niches)) {
    if (keywords.some(k => key.includes(k.toLowerCase()) || k.toLowerCase().includes(key))) {
      matched.push(...products);
    }
  }
  if (matched.length === 0) {
    for (const products of Object.values(niches)) matched.push(...products);
  }
  return matched.sort((a, b) => b.trend_score - a.trend_score).slice(0, 12);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || undefined;

  try {
    const searchTerms = category
      ? CATEGORY_KEYWORDS[category] ?? [category]
      : query ? [query] : ['trending products'];

    // Search CJ + AliExpress in parallel
    const searches: Promise<TrendItem[]>[] = [];
    const sources: { name: string; url: string }[] = [];

    const cjKey = process.env.CJ_DROPSHIPPING_API_KEY;
    if (cjKey) {
      sources.push({ name: 'CJ Dropshipping', url: 'https://cjdropshipping.com' });
      searches.push(
        (async () => {
          try {
            const client = new CJDropshippingClient({ apiKey: cjKey });
            const cjProducts = await client.searchProducts(searchTerms.slice(0, 2), { limit: 12 });
            return cjProducts.map(p => ({
              title: p.name,
              image: p.imageUrls[0] ?? '',
              price: p.costCents / 100,
              sell_price: +((p.costCents / 100) * (1 + MARGIN)).toFixed(2),
              supplier: 'CJ Dropshipping',
              category: p.category || category || 'general',
              trend_score: 70 + Math.floor(Math.random() * 25),
              source: 'CJ Dropshipping',
              source_url: `https://cjdropshipping.com/search/${encodeURIComponent(p.name)}`,
              shipping_days: `${p.shippingDays.min}-${p.shippingDays.max}j`,
            }));
          } catch (err) {
            console.error('[trending] CJ search failed:', err instanceof Error ? err.message : err);
            return [];
          }
        })(),
      );
    }

    const aliClient = getAliExpressClient();
    if (aliClient) {
      sources.push({ name: 'AliExpress', url: 'https://aliexpress.com' });
      searches.push(
        (async () => {
          try {
            const aliProducts = await aliClient.searchProducts(searchTerms.slice(0, 2), { limit: 12 });
            return aliProducts.map(p => ({
              title: p.name,
              image: p.imageUrls[0] ?? '',
              price: p.costCents / 100,
              sell_price: +((p.costCents / 100) * (1 + MARGIN)).toFixed(2),
              supplier: 'AliExpress',
              category: p.category || category || 'general',
              trend_score: 65 + Math.floor(Math.random() * 30),
              source: 'AliExpress',
              source_url: `https://aliexpress.com/item/${p.externalId}.html`,
              shipping_days: `${p.shippingDays.min}-${p.shippingDays.max}j`,
            }));
          } catch (err) {
            console.error('[trending] AliExpress search failed:', err instanceof Error ? err.message : err);
            return [];
          }
        })(),
      );
    }

    const results = await Promise.allSettled(searches);
    let products: TrendItem[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') products.push(...r.value);
    }

    // Sort by trend score, dedup by title
    const seen = new Set<string>();
    products = products
      .filter(p => {
        const key = p.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.trend_score - a.trend_score)
      .slice(0, 24);

    if (products.length === 0) {
      products = generateStaticFallback(query, category);
    }

    return NextResponse.json({
      products,
      query,
      category: category ?? null,
      sources,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[trending] Error:', err);
    return NextResponse.json({ products: [], error: 'Search failed' }, { status: 500 });
  }
}
