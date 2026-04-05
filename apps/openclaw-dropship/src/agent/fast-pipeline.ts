import type { PipelineEvent, PipelineInput, PipelineResult, EnrichedProduct, SiteContent } from './types.js';
import { CJClient } from '../services/cj-client.js';
import { generateSiteContent, generateProductDescriptions } from './content-writer.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? '';

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

const KEYWORD_TRANSLATIONS: Record<string, string> = {
  montres: 'watches', montre: 'watch', homme: 'men', femme: 'women',
  sacs: 'bags', sac: 'bag', chaussures: 'shoes', vetements: 'clothing',
  bijoux: 'jewelry', lunettes: 'sunglasses', accessoires: 'accessories',
  sport: 'sports', cuisine: 'kitchen', maison: 'home', jardin: 'garden',
  enfant: 'kids', bebe: 'baby', beaute: 'beauty', electronique: 'electronics',
  telephone: 'phone', ordinateur: 'computer', jouets: 'toys', animaux: 'pets',
  luxe: 'luxury', mode: 'fashion', tech: 'tech', fitness: 'fitness',
};

function translateToEnglish(keyword: string): string {
  const words = keyword.toLowerCase().trim().split(/\s+/);
  return words.map(w => KEYWORD_TRANSLATIONS[w] ?? w).join(' ');
}

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const OPENCLAW_PORT = Number(process.env['PORT'] ?? 3849);

const DESIGN_MAP: Record<string, string> = {
  tech: 'cyber',
  gaming: 'cyber',
  mode: 'radical',
  fashion: 'radical',
  art: 'avant',
  luxe: 'chrome',
  luxury: 'chrome',
  sport: 'swiss',
  default: 'swiss',
};

function pickDesignSystem(niche: string, positioning: string): string {
  const lower = niche.toLowerCase();
  for (const [key, ds] of Object.entries(DESIGN_MAP)) {
    if (lower.includes(key)) return ds;
  }
  return positioning === 'premium' ? 'chrome' : 'swiss';
}

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export async function runFastPipeline(
  input: PipelineInput,
  onEvent?: (event: PipelineEvent) => void,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const emit = (step: string, status: PipelineEvent['status'], detail?: unknown, progress?: number) => {
    const ev: PipelineEvent = { step, status, detail, progress, timestamp: Date.now() };
    onEvent?.(ev);
    console.log(`[fast-pipeline] ${step}: ${status}`, detail ? JSON.stringify(detail).slice(0, 200) : '');
    return ev;
  };

  const events: PipelineEvent[] = [];
  const track = (step: string, status: PipelineEvent['status'], detail?: unknown, progress?: number) => {
    const ev = emit(step, status, detail, progress);
    events.push(ev);
  };

  track('pipeline_start', 'running', { keywords: input.keywords, market: input.market ?? 'FR' }, 0);

  // Step 1: Search products
  track('search_products', 'running', undefined, 5);
  let rawProducts: Array<{ id?: string; name: string; image?: string; price_usd?: number; category?: string }> = [];

  try {
    const cj = new CJClient();
    const translatedKeywords = input.keywords.map(translateToEnglish);
    const audienceWords = new Set(['men', 'women', 'man', 'woman', 'kids', 'baby', 'boys', 'girls']);
    const searchQueries = translatedKeywords.map(kw => {
      const words = kw.split(/\s+/);
      const coreWords = words.filter(w => !audienceWords.has(w));
      return coreWords.length > 0 ? coreWords.join(' ') : kw;
    });
    console.log(`[fast-pipeline] Search queries: ${searchQueries.join(', ')} (from: ${input.keywords.join(', ')})`);
    const searchPromises = searchQueries.map(kw => cj.searchProducts(kw, 1, 20).catch(() => []));
    const allResults = await Promise.all(searchPromises);
    const flat = allResults.flat();

    rawProducts = flat.map(p => {
      const raw = p as unknown as Record<string, unknown>;
      return {
        id: String(raw.pid ?? ''),
        name: String(raw.productNameEn ?? ''),
        image: String(raw.productImage ?? ''),
        price_usd: Number(raw.sellPrice ?? 0),
        category: String(raw.categoryName ?? 'General'),
      };
    }).filter(p => p.name && p.price_usd > 0);

    const stopWords = new Set(['men', 'women', 'man', 'woman', 'for', 'the', 'and', 'with', 'new', 'de', 'a', 'le', 'la', 'les']);
    const coreKeywords = translatedKeywords
      .flatMap(k => k.split(/\s+/))
      .filter(w => !stopWords.has(w))
      .map(w => w.replace(/(?:es|s|ing)$/, ''));

    const seen = new Set<string>();
    rawProducts = rawProducts
      .filter(p => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        const nameLower = p.name.toLowerCase();
        return coreKeywords.some(kw => nameLower.includes(kw));
      })
      .slice(0, 20);

    track('search_products', 'done', { count: rawProducts.length, filtered_by: coreKeywords }, 15);
  } catch (err) {
    track('search_products', 'error', err instanceof Error ? err.message : 'unknown', 15);
    return { success: false, events, duration_ms: Date.now() - startTime };
  }

  if (rawProducts.length === 0) {
    track('no_products', 'error', 'No products found for the given keywords', 15);
    return { success: false, events, duration_ms: Date.now() - startTime };
  }

  // Step 2: Generate site content (parallel with product enrichment)
  track('generate_content', 'running', undefined, 20);
  const niche = input.keywords.join(', ');
  const designSystem = input.design_system ?? pickDesignSystem(niche, input.positioning ?? 'mid');
  const topProductNames = rawProducts.slice(0, 5).map(p => p.name);

  const [siteContent, enrichedProducts] = await Promise.all([
    generateSiteContent({
      niche,
      market: input.market ?? 'FR',
      positioning: input.positioning ?? 'mid',
      topProducts: topProductNames,
    }).catch(err => {
      console.error('[fast-pipeline] Content gen failed:', err);
      return null;
    }),
    (async () => {
      track('enrich_products', 'running', undefined, 30);
      try {
        const brandName = niche.split(',')[0].trim();
        const products = await generateProductDescriptions(
          rawProducts.map(p => ({
            name: p.name,
            category: p.category ?? 'General',
            costCents: Math.round((p.price_usd ?? 0) * 100),
            image: p.image,
            externalId: p.id,
          })),
          brandName,
          niche,
        );
        track('enrich_products', 'done', { count: products.length }, 60);
        return products;
      } catch (err) {
        track('enrich_products', 'error', err instanceof Error ? err.message : 'unknown', 60);
        return rawProducts.map(p => ({
          title: p.name,
          description: '',
          price: Math.round((p.price_usd ?? 0) * 2.5 * 100) / 100,
          cost_cents: Math.round((p.price_usd ?? 0) * 100),
          images: p.image ? [p.image] : [],
          seo_title: p.name,
          seo_description: '',
          category: p.category ?? 'General',
          supplier: 'cj',
          external_id: p.id ?? '',
        })) as EnrichedProduct[];
      }
    })(),
  ]);

  track('generate_content', siteContent ? 'done' : 'error',
    siteContent ? { brand: siteContent.brand?.name } : 'Content generation failed', 65);

  // Step 3: Create shop via launcher codegen
  track('create_shop', 'running', undefined, 70);
  const shopName = siteContent?.brand?.name ?? `Shop ${input.keywords[0]}`;
  const shopSlug = slugify(shopName);
  const port = 3101 + Math.floor(Math.random() * 90);

  try {
    // Call launcher API to generate site
    const launcherBody = {
      projectName: shopName,
      niche,
      outputDir: `~/sites/${shopSlug}`,
      designSystem,
      siteContent,
      products: enrichedProducts,
    };

    const res = await fetch(`http://localhost:3200/api/launcher/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(launcherBody),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      track('create_shop', 'error', `Launcher failed: HTTP ${res.status}: ${errBody.slice(0, 200)}`, 85);
      return { success: false, events, duration_ms: Date.now() - startTime };
    }

    // Parse SSE stream
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let siteUrl = '';
    let siteId = '';
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.step === 'launch' && data.status === 'done') {
                siteUrl = data.detail?.url || `http://${GPU2_HOST}:${port}`;
              }
              if (data.step === 'complete' && data.status === 'done') {
                siteId = data.detail?.site_id || '';
              }
            } catch { /* skip invalid JSON */ }
          }
        }
      }
    }

    const shopResult = {
      url: siteUrl || `http://${GPU2_HOST}:${port}`,
      site_id: siteId,
      sales_channel_id: '',
      products_created: enrichedProducts.length,
    };

    track('create_shop', 'done', { url: shopResult.url, products: shopResult.products_created }, 85);

    // Step 4: SEO Audit
    track('seo_audit', 'running', undefined, 88);
    const shopUrl = String(shopResult.url ?? `http://${GPU2_HOST}:${port}`);

    let seoResult: Record<string, unknown> | null = null;
    try {
      await new Promise(r => setTimeout(r, 5000));
      const seoRes = await fetch(shopUrl, { signal: AbortSignal.timeout(15_000) });
      const html = await seoRes.text();
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
      seoResult = {
        has_title: !!titleMatch,
        has_meta_desc: !!metaDescMatch,
        title: titleMatch?.[1],
      };
      track('seo_audit', 'done', seoResult, 92);
    } catch {
      track('seo_audit', 'skipped', 'Site not ready yet for audit', 92);
    }

    // Step 5: Marketing plans
    track('marketing_plans', 'running', undefined, 93);
    const marketingResult = {
      seo_done: !!seoResult,
      google_ads: {
        status: 'plan_ready',
        campaign: {
          type: 'SEARCH',
          daily_budget_eur: input.budget_eur ?? 10,
          keywords: input.keywords,
          landing_page: shopUrl,
        },
      },
      meta_ads: {
        status: 'plan_ready',
        campaign: {
          objective: 'CONVERSIONS',
          daily_budget_eur: input.budget_eur ?? 10,
          targeting: { interests: input.keywords, countries: [input.market ?? 'FR'] },
          website_url: shopUrl,
        },
      },
    };
    track('marketing_plans', 'done', marketingResult, 98);

    // Save campaigns to Supabase
    const finalSiteId = String(shopResult.site_id ?? '');
    if (finalSiteId) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const campaigns = [
            {
              site_id: finalSiteId,
              platform: 'google_ads',
              name: `${shopName} - Google Search`,
              daily_budget: (input.budget_eur ?? 10) * 100,
              status: 'draft',
              metrics: {},
              targeting: { keywords: input.keywords },
              creatives: { landing_page: shopUrl },
            },
            {
              site_id: finalSiteId,
              platform: 'meta',
              name: `${shopName} - Meta Conversions`,
              daily_budget: (input.budget_eur ?? 10) * 100,
              status: 'draft',
              metrics: {},
              targeting: { interests: input.keywords, countries: [input.market ?? 'US'] },
              creatives: { website_url: shopUrl },
            },
          ];
          await supabase.from('campaigns').insert(campaigns);
          console.log(`[fast-pipeline] Saved ${campaigns.length} campaign drafts`);
        }
      } catch (err) {
        console.error('[fast-pipeline] Campaign save failed:', err instanceof Error ? err.message : err);
      }
    }

    track('pipeline_complete', 'done', {
      shop: shopName,
      url: shopUrl,
      products: enrichedProducts.length,
      design: designSystem,
    }, 100);

    return {
      success: true,
      shop: {
        name: shopName,
        slug: shopSlug,
        url: shopUrl,
        site_id: String(shopResult.site_id ?? ''),
        sales_channel_id: String(shopResult.sales_channel_id ?? ''),
        products_created: Number(shopResult.products_created ?? enrichedProducts.length),
        design_system: designSystem,
      },
      marketing: marketingResult,
      events,
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    track('create_shop', 'error', msg, 85);
    return { success: false, events, duration_ms: Date.now() - startTime };
  }
}
