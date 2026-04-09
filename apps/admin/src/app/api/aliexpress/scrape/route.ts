import { NextRequest, NextResponse } from 'next/server';

interface AliExpressProduct {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  originalPrice?: string;
  rating?: number;
  orders?: number;
  storeUrl?: string;
  productUrl: string;
}

async function scrapeAliExpress(query: string, limit = 10): Promise<AliExpressProduct[]> {
  // AliExpress search URL
  const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`AliExpress returned ${response.status}`);
    }

    const html = await response.text();

    // Extract products from HTML
    // AliExpress embeds product data in window.runParams or similar
    const products: AliExpressProduct[] = [];

    // Try to find JSON data in script tags
    const scriptMatches = html.matchAll(/<script[^>]*>(.*?)<\/script>/gis);
    
    for (const match of scriptMatches) {
      const scriptContent = match[1];
      
      // Look for product data patterns
      if (scriptContent.includes('productId') || scriptContent.includes('itemId')) {
        // Try to extract JSON objects
        const jsonMatches = scriptContent.matchAll(/\{[^{}]*"productId"[^{}]*\}/g);
        
        for (const jsonMatch of jsonMatches) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.productId && data.title) {
              products.push({
                productId: String(data.productId),
                title: data.title,
                imageUrl: data.imageUrl || data.image || '',
                price: data.price || data.salePrice || '0',
                originalPrice: data.originalPrice,
                rating: data.rating || data.averageStarRate,
                orders: data.orders || data.tradeCount,
                storeUrl: data.storeUrl,
                productUrl: `https://www.aliexpress.com/item/${data.productId}.html`,
              });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Fallback: try to parse from window.runParams
    const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});/);
    if (runParamsMatch) {
      try {
        const runParams = JSON.parse(runParamsMatch[1]);
        if (runParams.items && Array.isArray(runParams.items)) {
          for (const item of runParams.items) {
            products.push({
              productId: String(item.productId || item.itemId),
              title: item.title || item.productTitle,
              imageUrl: item.imageUrl || item.image,
              price: item.price || item.salePrice || '0',
              originalPrice: item.originalPrice,
              rating: item.rating || item.averageStarRate,
              orders: item.orders || item.tradeCount,
              storeUrl: item.storeUrl,
              productUrl: `https://www.aliexpress.com/item/${item.productId || item.itemId}.html`,
            });
          }
        }
      } catch {
        // Skip
      }
    }

    return products.slice(0, limit);
  } catch (error) {
    console.error('[AliExpress Scrape] Error:', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '10'), 50);

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    const products = await scrapeAliExpress(query, limit);
    
    return NextResponse.json({
      success: true,
      query,
      count: products.length,
      products,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[AliExpress Scrape] Failed:', msg);
    
    return NextResponse.json({
      success: false,
      error: msg,
      query,
    }, { status: 500 });
  }
}
