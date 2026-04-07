import type { PipelineEvent, PipelineInput, PipelineResult, EnrichedProduct, SiteContent } from './types.js';
import { CJClient } from '../services/cj-client.js';
import { generateSiteContent, generateProductDescriptions, withRetry } from './content-writer.js';
import { normalizePipelineInput } from './input-normalizer.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

// ─── OpenCore Config ───

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const ADMIN_URL = process.env['ADMIN_URL'] ?? `http://${GPU2_HOST}:3200`;
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? '';

const SHOP_TIMEOUT_MS = 600_000;
const HEALTH_POLL_ATTEMPTS = 5;
const HEALTH_POLL_INTERVAL_MS = 3_000;
const PRICE_MULTIPLIER = 2.5;
const MAX_PRODUCTS = 20;

const DESIGN_MAP: Record<string, string> = {
  tech: 'cyber', gaming: 'cyber', electronic: 'cyber',
  fashion: 'radical', mode: 'radical', clothing: 'radical',
  art: 'avant', design: 'avant', creative: 'avant',
  luxury: 'chrome', luxe: 'chrome', premium: 'chrome', jewelry: 'chrome', watches: 'chrome',
  sport: 'swiss', fitness: 'swiss', health: 'swiss',
};

// ─── OpenCore: Utilities ───

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function pickDesignSystem(niche: string, positioning: string): string {
  const lower = niche.toLowerCase();
  for (const [keyword, ds] of Object.entries(DESIGN_MAP)) {
    if (lower.includes(keyword)) return ds;
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

function fallbackSiteContent(niche: string, market: string): SiteContent {
  const primary = niche.split(',')[0].trim();
  const brandName = primary.charAt(0).toUpperCase() + primary.slice(1) + ' Store';
  const region = market === 'US' ? 'the US' : market === 'EU' ? 'Europe' : 'France';

  return {
    brand: {
      name: brandName,
      tagline: `Your destination for ${primary}`,
      tone_of_voice: 'professional',
      color_mood: 'clean and modern',
    },
    hero_title: `Shop ${primary}`,
    hero_subtitle: `Discover our curated collection of premium ${primary} products`,
    hero_cta: 'Shop Now',
    about_html: `<p>Welcome to ${brandName}. We bring you the best ${primary} products, carefully selected for quality and value.</p>`,
    shipping_policy: `<p>Free shipping on orders over €50. Standard delivery: 7-15 business days to ${region}.</p>`,
    return_policy: '<p>14-day return policy. Items must be unused and in original packaging. Contact us to initiate a return.</p>',
    seo_title: `${brandName} — ${primary} online`,
    seo_description: `Shop the best ${primary} products online. Quality guaranteed, fast shipping.`,
    seo_keywords: niche.split(',').map(k => k.trim()),
  };
}

async function pollHealth(url: string): Promise<boolean> {
  for (let i = 0; i < HEALTH_POLL_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return true;
    } catch {}
    if (i < HEALTH_POLL_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
    }
  }
  return false;
}

// ─── OpenCore Pipeline ───

export async function runFastPipeline(
  input: PipelineInput,
  onEvent?: (event: PipelineEvent) => void,
): Promise<PipelineResult> {
  const t0 = Date.now();
  const events: PipelineEvent[] = [];

  const emit = (step: string, status: PipelineEvent['status'], detail?: unknown, progress?: number) => {
    const ev: PipelineEvent = { step, status, detail, progress, timestamp: Date.now() };
    events.push(ev);
    onEvent?.(ev);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const logFn = status === 'error' ? logger.error : logger.info;
    logFn('pipeline', `[${elapsed}s] ${step}: ${status}`, detail ? JSON.stringify(detail).slice(0, 200) : undefined);
    return ev;
  };

  const fail = (step: string, detail: unknown): PipelineResult => {
    emit(step, 'error', detail);
    return { success: false, events, duration_ms: Date.now() - t0 };
  };

  // ── Step 0: Input validation ──

  let normalized: { keywords: string[]; market: 'FR' | 'EU' | 'US'; positioning: 'budget' | 'mid' | 'premium' };
  try {
    normalized = normalizePipelineInput({
      keywords: input.keywords,
      market: input.market,
      positioning: input.positioning,
    });
  } catch (err) {
    return fail('input_validation', err instanceof Error ? err.message : String(err));
  }

  emit('pipeline_start', 'running', {
    keywords: normalized.keywords,
    market: normalized.market,
    positioning: normalized.positioning,
  }, 0);

  // ── Step 1: Product search (CJ) with retry ──

  emit('search_products', 'running', undefined, 5);

  type RawProduct = { id: string; name: string; image: string; price_usd: number; category: string };
  let rawProducts: RawProduct[] = [];

  try {
    rawProducts = await withRetry(async () => {
      const cj = new CJClient();
      const audienceWords = new Set(['men', 'women', 'man', 'woman', 'kids', 'baby', 'boys', 'girls']);

      const queries = normalized.keywords.map(kw => {
        const words = kw.split(/\s+/);
        const core = words.filter(w => !audienceWords.has(w));
        return core.length > 0 ? core.join(' ') : kw;
      });

      logger.info('pipeline', 'CJ search queries', { queries });

      const results = await Promise.all(
        queries.map(q => cj.searchProducts(q, 1, MAX_PRODUCTS).catch(() => [])),
      );

      const flat = results.flat().map(p => {
        const raw = p as unknown as Record<string, unknown>;
        return {
          id: String(raw.pid ?? ''),
          name: String(raw.productNameEn ?? ''),
          image: String(raw.productImage ?? ''),
          price_usd: Number(raw.sellPrice ?? 0),
          category: String(raw.categoryName ?? 'General'),
        };
      }).filter(p => p.name && p.price_usd > 0);

      if (flat.length === 0) throw new Error('No products returned from CJ');

      const stopWords = new Set(['men', 'women', 'man', 'woman', 'for', 'the', 'and', 'with', 'new', 'de', 'a', 'le', 'la', 'les']);
      const coreKw = normalized.keywords
        .flatMap(k => k.split(/\s+/))
        .filter(w => !stopWords.has(w))
        .map(w => w.replace(/(?:es|s|ing)$/, ''));

      const seen = new Set<string>();
      return flat
        .filter(p => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          const lower = p.name.toLowerCase();
          return coreKw.some(kw => lower.includes(kw));
        })
        .slice(0, MAX_PRODUCTS);
    }, { attempts: 2, delayMs: 2000, label: 'CJ product search' });

    emit('search_products', 'done', { count: rawProducts.length }, 15);
  } catch (err) {
    return fail('search_products', err instanceof Error ? err.message : 'Product search failed');
  }

  if (rawProducts.length === 0) {
    return fail('no_products', 'No products found matching keywords');
  }

  // ── Step 2: Content generation + product enrichment (parallel) ──

  emit('generate_content', 'running', undefined, 20);

  const niche = normalized.keywords.join(', ');
  const designSystem = input.design_system ?? pickDesignSystem(niche, normalized.positioning);
  const topProductNames = rawProducts.slice(0, 5).map(p => p.name);

  const [contentResult, enrichedProducts] = await Promise.all([
    generateSiteContent({
      niche,
      market: normalized.market,
      positioning: normalized.positioning,
      topProducts: topProductNames,
    }).catch(err => {
      logger.error('pipeline', 'Content generation failed, using fallback', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }),

    (async (): Promise<EnrichedProduct[]> => {
      emit('enrich_products', 'running', undefined, 30);
      try {
        const brandName = niche.split(',')[0].trim();
        const products = await generateProductDescriptions(
          rawProducts.map(p => ({
            name: p.name,
            category: p.category,
            costCents: Math.round(p.price_usd * 100),
            image: p.image,
            externalId: p.id,
          })),
          brandName,
          niche,
        );
        emit('enrich_products', 'done', { count: products.length }, 60);
        return products;
      } catch (err) {
        logger.error('pipeline', 'Product enrichment failed, using raw data', { error: err instanceof Error ? err.message : String(err) });
        emit('enrich_products', 'error', 'Falling back to raw product data', 60);
        return rawProducts.map(p => ({
          title: p.name,
          description: '',
          price: Math.round(p.price_usd * PRICE_MULTIPLIER * 100) / 100,
          cost_cents: Math.round(p.price_usd * 100),
          images: p.image ? [p.image] : [],
          seo_title: p.name,
          seo_description: '',
          category: p.category,
          supplier: 'cj',
          external_id: p.id,
        }));
      }
    })(),
  ]);

  const siteContent = contentResult ?? fallbackSiteContent(niche, normalized.market);
  const contentSource = contentResult ? 'llm' : 'fallback';

  emit('generate_content', 'done', { brand: siteContent.brand.name, source: contentSource }, 65);

  // ── Step 3: Create shop via launcher ──

  emit('create_shop', 'running', undefined, 70);

  const shopName = siteContent.brand.name || `Shop ${normalized.keywords[0]}`;
  const shopSlug = slugify(shopName);
  const port = 3101 + Math.floor(Math.random() * 90);

  try {
    const launcherBody = {
      projectName: shopName,
      niche,
      outputDir: `~/sites/${shopSlug}`,
      designSystem,
      siteContent,
      products: enrichedProducts,
    };

    const res = await fetch(`${ADMIN_URL}/api/launcher/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(launcherBody),
      signal: AbortSignal.timeout(SHOP_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return fail('create_shop', `Launcher HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let siteUrl = '';
    let siteId = '';

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.step === 'launch' && data.status === 'done') {
              siteUrl = data.detail?.url || `http://${GPU2_HOST}:${port}`;
            }
            if (data.step === 'complete' && data.status === 'done') {
              siteId = data.detail?.site_id || '';
            }
          } catch {}
        }
      }
    }

    const shopUrl = siteUrl || `http://${GPU2_HOST}:${port}`;

    emit('create_shop', 'done', {
      url: shopUrl,
      products: enrichedProducts.length,
      design: designSystem,
    }, 85);

    // ── Step 4: Health check with polling ──

    emit('check_health', 'running', { url: shopUrl }, 86);

    const healthy = await pollHealth(shopUrl);

    emit('check_health', healthy ? 'done' : 'error',
      healthy
        ? { status: 'up' }
        : { status: 'unreachable', attempts: HEALTH_POLL_ATTEMPTS },
      88,
    );

    // ── Step 5: SEO audit ──

    emit('seo_audit', 'running', undefined, 89);

    let seoResult: Record<string, unknown> | null = null;
    if (healthy) {
      try {
        const seoRes = await fetch(shopUrl, { signal: AbortSignal.timeout(15_000) });
        const html = await seoRes.text();
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
        const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);

        seoResult = {
          has_title: !!titleMatch,
          has_meta_desc: !!metaDesc,
          has_h1: !!h1,
          title: titleMatch?.[1],
          score: 100 - (titleMatch ? 0 : 20) - (metaDesc ? 0 : 15) - (h1 ? 0 : 15),
        };
        emit('seo_audit', 'done', seoResult, 92);
      } catch {
        emit('seo_audit', 'skipped', 'Fetch failed for SEO audit', 92);
      }
    } else {
      emit('seo_audit', 'skipped', 'Site not healthy, skipping SEO', 92);
    }

    // ── Step 6: Marketing plans ──

    emit('marketing_plans', 'running', undefined, 93);

    const budget = input.budget_eur ?? 10;
    const marketingResult = {
      seo_done: !!seoResult,
      google_ads: {
        status: 'plan_ready',
        campaign: {
          type: 'SEARCH',
          daily_budget_eur: budget,
          keywords: normalized.keywords,
          landing_page: shopUrl,
        },
      },
      meta_ads: {
        status: 'plan_ready',
        campaign: {
          objective: 'CONVERSIONS',
          daily_budget_eur: budget,
          targeting: { interests: normalized.keywords, countries: [normalized.market] },
          website_url: shopUrl,
        },
      },
    };

    emit('marketing_plans', 'done', { google: 'plan_ready', meta: 'plan_ready' }, 98);

    // ── Step 7: Save campaigns to Supabase ──

    if (siteId) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('campaigns').insert([
            {
              site_id: siteId,
              platform: 'google_ads',
              name: `${shopName} - Google Search`,
              daily_budget: budget * 100,
              status: 'draft',
              metrics: {},
              targeting: { keywords: normalized.keywords },
              creatives: { landing_page: shopUrl },
            },
            {
              site_id: siteId,
              platform: 'meta',
              name: `${shopName} - Meta Conversions`,
              daily_budget: budget * 100,
              status: 'draft',
              metrics: {},
              targeting: { interests: normalized.keywords, countries: [normalized.market] },
              creatives: { website_url: shopUrl },
            },
          ]);
          logger.info('pipeline', 'Saved campaign drafts to Supabase');
        }
      } catch (err) {
        logger.error('pipeline', 'Campaign save failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── Complete ──

    emit('pipeline_complete', 'done', {
      shop: shopName,
      url: shopUrl,
      products: enrichedProducts.length,
      design: designSystem,
      content_source: contentSource,
      healthy,
    }, 100);

    return {
      success: true,
      shop: {
        name: shopName,
        slug: shopSlug,
        url: shopUrl,
        site_id: siteId,
        sales_channel_id: '',
        products_created: enrichedProducts.length,
        design_system: designSystem,
      },
      marketing: marketingResult,
      events,
      duration_ms: Date.now() - t0,
    };
  } catch (err) {
    return fail('create_shop', err instanceof Error ? err.message : String(err));
  }
}
