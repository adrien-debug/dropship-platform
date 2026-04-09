import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { CJClient } from '../services/cj-client.js';
import { AliExpressClient } from '../services/aliexpress-client.js';
import { logger } from '../logger.js';
import { matchTrendSeeds, type TrendSeed } from '../data/trending-2026.js';

const EXA_API_KEY = process.env['EXA_API_KEY'] ?? '';
const EXA_BASE_URL = 'https://api.exa.ai';
const PPSPY_API_KEY = process.env['PPSPY_API_KEY'] ?? '';
const PPSPY_BASE_URL = 'https://api.ppspy.com';

export const productScoutRouter = Router();

const scoutSchema = z.object({
  niche: z.string().min(1).max(200),
  market: z.enum(['FR', 'EU', 'US', 'WORLD']).default('FR'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  minMargin: z.coerce.number().min(0).max(10).default(1.5),
});

interface ScoutProduct {
  title: string;
  image: string;
  costCents: number;
  sellPrice: number;
  margin: number;
  supplier: string;
  supplierId: string;
  category: string;
  shippingDays: string;
  score: number;
  scoreBreakdown: {
    marginScore: number;
    priceScore: number;
    imageScore: number;
    shippingScore: number;
    trendScore: number;
  };
  trendSignals: string[];
  trendMatch?: TrendSeed;
}

// ---------------------------------------------------------------------------
// Exa search for trend signals
// ---------------------------------------------------------------------------

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  highlights?: string[];
}

async function searchTrends(niche: string): Promise<{ keywords: string[]; signals: string[] }> {
  const queries = [
    `best selling ${niche} products 2026 trending dropshipping`,
    `winning ${niche} products ecommerce high demand`,
  ];

  const keywords: string[] = [];
  const signals: string[] = [];

  for (const query of queries) {
    try {
      if (EXA_API_KEY) {
        const res = await fetch(`${EXA_BASE_URL}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': EXA_API_KEY,
          },
          body: JSON.stringify({
            query,
            numResults: 5,
            type: 'auto',
            useAutoprompt: true,
            contents: { highlights: { numSentences: 2 } },
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) {
          const data = (await res.json()) as { results?: ExaResult[] };
          for (const r of data.results ?? []) {
            if (r.highlights) {
              for (const h of r.highlights) {
                signals.push(h);
                const words = h
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, '')
                  .split(/\s+/)
                  .filter(w => w.length > 3);
                keywords.push(...words.slice(0, 3));
              }
            }
          }
          logger.info('scout', `Exa returned ${data.results?.length ?? 0} results for "${query}"`);
        }
      }
    } catch (err) {
      logger.warn('scout', `Exa search failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (keywords.length === 0) {
    keywords.push(...niche.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  }

  const unique = [...new Set(keywords)].slice(0, 8);
  return { keywords: unique, signals: [...new Set(signals)].slice(0, 10) };
}

// ---------------------------------------------------------------------------
// PPSPY bestsellers search
// ---------------------------------------------------------------------------

interface PPSPYProduct {
  title: string;
  image: string;
  price: number;
  store_name: string;
  store_url: string;
  product_url: string;
  id: string;
}

async function searchPPSPY(niche: string, limit: number): Promise<ScoutProduct[]> {
  if (!PPSPY_API_KEY) return [];
  const results: ScoutProduct[] = [];
  try {
    const res = await fetch(`${PPSPY_BASE_URL}/api/v1/shopify/product/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PPSPY_API_KEY}`,
      },
      body: JSON.stringify({
        keyword: niche,
        sort_by: 'monthly_sales',
        sort_order: 'desc',
        page: 1,
        page_size: Math.min(limit, 20),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = (await res.json()) as { data?: { list?: PPSPYProduct[] } };
      const list = data.data?.list ?? [];
      for (const p of list) {
        const costEst = Math.round(p.price * 0.35 * 100);
        results.push({
          title: p.title,
          image: p.image ?? '',
          costCents: costEst,
          sellPrice: p.price,
          margin: +(p.price - costEst / 100).toFixed(2),
          supplier: `PPSPY/Shopify (${p.store_name ?? 'unknown'})`,
          supplierId: p.id ?? p.product_url ?? '',
          category: 'shopify-bestseller',
          shippingDays: 'N/A',
          score: 0,
          scoreBreakdown: { marginScore: 0, priceScore: 0, imageScore: 0, shippingScore: 0, trendScore: 0 },
          trendSignals: [],
        });
      }
      logger.info('scout', `PPSPY returned ${list.length} bestsellers`);
    } else {
      logger.warn('scout', `PPSPY HTTP ${res.status}: ${await res.text().catch(() => '(no body)')}`);
    }
  } catch (err) {
    logger.warn('scout', `PPSPY failed: ${err instanceof Error ? err.message : err}`);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Score a product (with trend seed boost)
// ---------------------------------------------------------------------------

function scoreProduct(
  product: { costCents: number; imageUrls: string[]; shippingDays: { min: number; max: number }; name: string },
  minMargin: number,
  trendKeywords: string[],
  trendSeeds: TrendSeed[],
): {
  score: number;
  sellPrice: number;
  margin: number;
  breakdown: ScoutProduct['scoreBreakdown'];
  trendSignals: string[];
  bestSeedMatch?: TrendSeed;
} {
  const cost = product.costCents / 100;
  const sellPrice = +(cost * (1 + Math.max(minMargin, 1.5))).toFixed(2);
  const margin = sellPrice - cost;
  const marginPct = cost > 0 ? margin / cost : 0;

  const marginScore = Math.min(30, Math.round(marginPct * 15));

  let priceScore = 0;
  if (sellPrice >= 10 && sellPrice <= 50) priceScore = 25;
  else if (sellPrice >= 5 && sellPrice <= 80) priceScore = 15;
  else if (sellPrice < 5) priceScore = 5;
  else priceScore = 8;

  const imageScore = product.imageUrls.length >= 3 ? 15 : product.imageUrls.length >= 1 ? 10 : 0;

  let shippingScore = 0;
  if (product.shippingDays.max <= 12) shippingScore = 15;
  else if (product.shippingDays.max <= 20) shippingScore = 10;
  else if (product.shippingDays.max <= 30) shippingScore = 5;

  const nameLower = product.name.toLowerCase();
  const matched = trendKeywords.filter(k => nameLower.includes(k));
  let trendScore = Math.min(15, matched.length * 5);

  let bestSeedMatch: TrendSeed | undefined;
  for (const seed of trendSeeds) {
    const kwHits = seed.keywords.filter(kw => nameLower.includes(kw));
    if (kwHits.length >= 2) {
      bestSeedMatch = seed;
      const seedBonus = seed.searchTrend === 'hot' ? 10 : seed.searchTrend === 'rising' ? 7 : 4;
      trendScore = Math.min(25, trendScore + seedBonus);
      matched.push(`[TREND 2026: ${seed.name}]`);
      break;
    } else if (kwHits.length === 1 && !bestSeedMatch) {
      bestSeedMatch = seed;
      trendScore = Math.min(20, trendScore + 3);
      matched.push(`[TREND 2026: ${seed.name}]`);
    }
  }

  const score = marginScore + priceScore + imageScore + shippingScore + trendScore;

  return { score, sellPrice, margin, breakdown: { marginScore, priceScore, imageScore, shippingScore, trendScore }, trendSignals: matched, bestSeedMatch };
}

// ---------------------------------------------------------------------------
// GET /products/scout?niche=...&market=FR&limit=20&minMargin=1.5
// ---------------------------------------------------------------------------

productScoutRouter.get('/scout', async (req: Request, res: Response) => {
  const parsed = scoutSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const { niche, market, limit, minMargin } = parsed.data;
  const start = Date.now();

  logger.info('scout', `Starting scout: niche="${niche}" market=${market} limit=${limit}`);

  // Step 0: Match trend seeds from curated 2026 data
  const { matched: trendSeeds, boostKeywords } = matchTrendSeeds(niche);
  logger.info('scout', `Trend seeds matched: ${trendSeeds.length} products, boost kw: ${boostKeywords.join(', ')}`);

  // Step 1: Get trend signals from Exa
  const { keywords: exaKeywords, signals: trendSignals } = await searchTrends(niche);
  const trendKeywords = [...new Set([...exaKeywords, ...boostKeywords])].slice(0, 12);
  logger.info('scout', `Combined trend keywords: ${trendKeywords.join(', ')}`);

  // Step 2: Search suppliers in parallel
  const nicheWords = niche.split(/\s+/).filter(w => w.length > 2);
  const searchQueries = [niche, ...nicheWords, ...trendKeywords.slice(0, 3)];
  const uniqueQueries = [...new Set(searchQueries)].slice(0, 5);
  const allProducts: ScoutProduct[] = [];
  const errors: { source: string; error: string }[] = [];

  const supplierSearches: Promise<void>[] = [];

  // CJ search
  supplierSearches.push(
    (async () => {
      try {
        const cj = new CJClient();
        const perQuery = Math.ceil(Math.min(limit, 30) / Math.min(uniqueQueries.length, 2));
        const products: Awaited<ReturnType<typeof cj.searchProducts>> = [];
        for (let i = 0; i < Math.min(uniqueQueries.length, 2); i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 1500));
          const batch = await cj.searchProducts(uniqueQueries[i]!, 1, perQuery);
          products.push(...batch);
        }
        for (const p of products) {
          const { score, sellPrice, margin, breakdown, trendSignals: matched, bestSeedMatch } = scoreProduct(
            { costCents: p.costCents, imageUrls: p.imageUrls, shippingDays: p.shippingDays, name: p.name },
            minMargin,
            trendKeywords,
            trendSeeds,
          );
          allProducts.push({
            title: p.name,
            image: p.imageUrls[0] ?? '',
            costCents: p.costCents,
            sellPrice,
            margin,
            supplier: 'CJ Dropshipping',
            supplierId: p.externalId,
            category: p.category,
            shippingDays: `${p.shippingDays.min}-${p.shippingDays.max}j`,
            score,
            scoreBreakdown: breakdown,
            trendSignals: matched,
            trendMatch: bestSeedMatch,
          });
        }
        logger.info('scout', `CJ returned ${products.length} products`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('scout', `CJ failed: ${msg}`);
        errors.push({ source: 'cj', error: msg });
      }
    })(),
  );

  // AliExpress search
  supplierSearches.push(
    (async () => {
      try {
        const ali = AliExpressClient.create();
        if (!ali) {
          errors.push({ source: 'aliexpress', error: 'Not configured' });
          return;
        }
        const products = await ali.searchProducts(uniqueQueries.slice(0, 3), { limit: Math.min(limit, 30) });
        for (const p of products) {
          const { score, sellPrice, margin, breakdown, trendSignals: matched, bestSeedMatch } = scoreProduct(
            { costCents: p.costCents, imageUrls: p.imageUrls, shippingDays: p.shippingDays, name: p.name },
            minMargin,
            trendKeywords,
            trendSeeds,
          );
          allProducts.push({
            title: p.name,
            image: p.imageUrls[0] ?? '',
            costCents: p.costCents,
            sellPrice,
            margin,
            supplier: 'AliExpress',
            supplierId: p.externalId,
            category: p.category,
            shippingDays: `${p.shippingDays.min}-${p.shippingDays.max}j`,
            score,
            scoreBreakdown: breakdown,
            trendSignals: matched,
            trendMatch: bestSeedMatch,
          });
        }
        logger.info('scout', `AliExpress returned ${products.length} products`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('scout', `AliExpress failed: ${msg}`);
        errors.push({ source: 'aliexpress', error: msg });
      }
    })(),
  );

  // PPSPY Shopify bestsellers
  supplierSearches.push(
    (async () => {
      try {
        const ppspyProducts = await searchPPSPY(niche, limit);
        for (const p of ppspyProducts) {
          const nameLower = p.title.toLowerCase();
          const kwMatched = trendKeywords.filter(k => nameLower.includes(k));
          let trendScore = Math.min(15, kwMatched.length * 5);

          let bestSeedMatch: TrendSeed | undefined;
          for (const seed of trendSeeds) {
            const hits = seed.keywords.filter(kw => nameLower.includes(kw));
            if (hits.length >= 2) {
              bestSeedMatch = seed;
              trendScore = Math.min(25, trendScore + (seed.searchTrend === 'hot' ? 10 : 7));
              kwMatched.push(`[TREND 2026: ${seed.name}]`);
              break;
            }
          }

          // PPSPY products are already proven sellers — bonus 15 pts
          const provenSellerBonus = 15;
          const priceScore = p.sellPrice >= 10 && p.sellPrice <= 50 ? 25 : p.sellPrice >= 5 && p.sellPrice <= 80 ? 15 : 8;
          const marginScore = Math.min(30, Math.round(((p.sellPrice - p.costCents / 100) / (p.costCents / 100 || 1)) * 15));

          p.score = marginScore + priceScore + (p.image ? 10 : 0) + trendScore + provenSellerBonus;
          p.scoreBreakdown = { marginScore, priceScore, imageScore: p.image ? 10 : 0, shippingScore: 0, trendScore };
          p.trendSignals = [...kwMatched, '[PROVEN SHOPIFY BESTSELLER]'];
          p.trendMatch = bestSeedMatch;
          allProducts.push(p);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('scout', `PPSPY integration failed: ${msg}`);
        errors.push({ source: 'ppspy', error: msg });
      }
    })(),
  );

  await Promise.allSettled(supplierSearches);

  // Step 3: Deduplicate by title similarity, sort by score
  const seen = new Set<string>();
  const ranked = allProducts
    .filter(p => {
      const key = p.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const elapsed = Date.now() - start;
  logger.info('scout', `Scout done: ${ranked.length} products ranked in ${elapsed}ms`);

  const sources = ['CJ Dropshipping', 'AliExpress'];
  if (EXA_API_KEY) sources.push('Exa Search');
  if (PPSPY_API_KEY) sources.push('PPSPY/Shopify');
  sources.push('Trend Seed DB 2026');

  res.json({
    niche,
    market,
    products: ranked,
    meta: {
      total_found: allProducts.length,
      returned: ranked.length,
      trend_seeds_matched: trendSeeds.map(s => ({ name: s.name, trend: s.searchTrend, category: s.category })),
      trend_keywords: trendKeywords,
      trend_signals: trendSignals,
      sources,
      errors: errors.length > 0 ? errors : undefined,
      elapsed_ms: elapsed,
    },
  });
});
