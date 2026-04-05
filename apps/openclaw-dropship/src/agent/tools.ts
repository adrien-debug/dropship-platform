import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ToolDefinition, EnrichedProduct, SiteContent } from './types.js';
import { CJClient } from '../services/cj-client.js';
import { MedusaClient } from '../services/medusa-client.js';
import { generateSiteContent, generateProductDescriptions } from './content-writer.js';

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const OPENCLAW_URL = `http://${GPU2_HOST}:${Number(process.env['PORT'] ?? 3849)}`;

function toolSpec(name: string, description: string, parameters: Record<string, unknown>): ChatCompletionTool {
  return {
    type: 'function' as const,
    function: { name, description, parameters: { type: 'object', ...parameters } },
  };
}

// ---------- Tool: search_products ----------
const searchProductsHandler = async (args: Record<string, unknown>) => {
  const keywords = args['keywords'] as string[];
  const limit = (args['limit'] as number) ?? 30;
  const results: { source: string; products: unknown[] }[] = [];

  try {
    const cj = new CJClient();
    const cjProducts = await Promise.all(
      keywords.map(k => cj.searchProducts(k, 1, Math.ceil(limit / keywords.length)))
    );
    const flat = cjProducts.flat().slice(0, limit);
    results.push({
      source: 'cj',
      products: flat.map(p => {
        const raw = p as unknown as Record<string, unknown>;
        return {
          id: raw.pid,
          name: raw.productNameEn,
          image: raw.productImage,
          price_usd: raw.sellPrice,
          category: raw.categoryName ?? 'General',
        };
      }),
    });
  } catch (err) {
    console.error('[tools:search] CJ failed:', err instanceof Error ? err.message : err);
  }

  try {
    const medusa = new MedusaClient();
    for (const kw of keywords) {
      const mp = await medusa.searchProducts(kw, 1, 10);
      if (mp.length > 0) results.push({ source: 'medusa', products: mp });
    }
  } catch (err) {
    console.error('[tools:search] Medusa failed:', err instanceof Error ? err.message : err);
  }

  return { total: results.reduce((s, r) => s + r.products.length, 0), results };
};

// ---------- Tool: enrich_products ----------
const enrichProductsHandler = async (args: Record<string, unknown>) => {
  const products = args['products'] as Array<{
    name: string; category: string; price_usd: number; image?: string; id?: string;
  }>;
  const brand = args['brand_name'] as string | undefined;
  const niche = args['niche'] as string | undefined;

  const enriched = await generateProductDescriptions(
    products.map(p => ({
      name: p.name,
      category: p.category ?? 'General',
      costCents: Math.round((p.price_usd ?? 0) * 100),
      image: p.image,
      externalId: p.id,
    })),
    brand ?? 'Our Store',
    niche ?? 'e-commerce',
  );

  return { enriched_count: enriched.length, products: enriched };
};

// ---------- Tool: generate_site_content ----------
const generateSiteContentHandler = async (args: Record<string, unknown>) => {
  const niche = args['niche'] as string;
  const market = (args['market'] as string) ?? 'FR';
  const positioning = (args['positioning'] as string) ?? 'mid';
  const topProducts = (args['top_product_names'] as string[]) ?? [];

  const content = await generateSiteContent({ niche, market, positioning, topProducts });
  return content;
};

// ---------- Tool: create_shop ----------
const createShopHandler = async (args: Record<string, unknown>) => {
  const name = args['name'] as string;
  const slug = args['slug'] as string;
  const port = (args['port'] as number) ?? 3101 + Math.floor(Math.random() * 90);
  const design_system = (args['design_system'] as string) ?? 'swiss';
  const products = args['products'] as EnrichedProduct[];
  const site_content = args['site_content'] as SiteContent | undefined;

  const body = {
    name,
    slug,
    port,
    design_system,
    products: products.map(p => ({
      title: p.title,
      price: p.price,
      image: p.images?.[0],
      description: p.description,
      images: p.images,
      seo_title: p.seo_title,
      seo_description: p.seo_description,
    })),
    site_content,
  };

  const res = await fetch(`${OPENCLAW_URL}/shop/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Shop creation failed: ${res.status} ${err.slice(0, 200)}`);
  }

  return res.json();
};

// ---------- Tool: check_health ----------
const checkHealthHandler = async (args: Record<string, unknown>) => {
  const url = args['url'] as string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, status: 0, ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
};

// ---------- Tool: create_google_ads ----------
const createGoogleAdsHandler = async (args: Record<string, unknown>) => {
  const shopUrl = args['shop_url'] as string;
  const budget = (args['daily_budget_eur'] as number) ?? 10;
  const keywords = args['keywords'] as string[];
  const headlines = args['headlines'] as string[];
  const descriptions = args['descriptions'] as string[];

  return {
    status: 'plan_ready',
    campaign: {
      type: 'SEARCH',
      daily_budget_eur: budget,
      keywords,
      ad: { headlines: headlines?.slice(0, 15), descriptions: descriptions?.slice(0, 4) },
      landing_page: shopUrl,
      note: 'Requires Google Ads API credentials or Adspirer connection to execute',
    },
  };
};

// ---------- Tool: create_meta_ads ----------
const createMetaAdsHandler = async (args: Record<string, unknown>) => {
  const shopUrl = args['shop_url'] as string;
  const budget = (args['daily_budget_eur'] as number) ?? 10;
  const audiences = args['target_interests'] as string[];
  const adCopy = args['ad_copy'] as string;

  return {
    status: 'plan_ready',
    campaign: {
      objective: 'CONVERSIONS',
      daily_budget_eur: budget,
      targeting: { interests: audiences, countries: ['FR'], age_min: 18, age_max: 65 },
      ad: { primary_text: adCopy, website_url: shopUrl },
      note: 'Requires Meta Ads API access or Adspirer connection to execute',
    },
  };
};

// ---------- Tool: run_seo_audit ----------
const runSeoAuditHandler = async (args: Record<string, unknown>) => {
  const url = args['url'] as string;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/i);
    const hasRobotsMeta = /noindex/i.test(html);
    const imgCount = (html.match(/<img /gi) || []).length;
    const imgNoAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;

    return {
      url,
      title: titleMatch?.[1] ?? 'MISSING',
      meta_description: metaDescMatch?.[1] ?? 'MISSING',
      h1: h1Match?.[1] ?? 'MISSING',
      canonical: canonicalMatch?.[1] ?? 'MISSING',
      noindex: hasRobotsMeta,
      images_total: imgCount,
      images_missing_alt: imgNoAlt,
      issues: [
        ...(!titleMatch ? ['Missing <title> tag'] : []),
        ...(!metaDescMatch ? ['Missing meta description'] : []),
        ...(!h1Match ? ['Missing <h1> heading'] : []),
        ...(imgNoAlt > 0 ? [`${imgNoAlt} images missing alt text`] : []),
        ...(hasRobotsMeta ? ['Page has noindex — will not be indexed'] : []),
      ],
      score: Math.max(0, 100 - (titleMatch ? 0 : 20) - (metaDescMatch ? 0 : 15) - (h1Match ? 0 : 15) - (imgNoAlt * 5) - (hasRobotsMeta ? 30 : 0)),
    };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : 'fetch failed', score: 0 };
  }
};

// ---------- REGISTRY ----------

export function createToolRegistry(): ToolDefinition[] {
  return [
    {
      spec: toolSpec('search_products', 'Search products from CJ Dropshipping and Medusa catalog by keywords', {
        properties: {
          keywords: { type: 'array', items: { type: 'string' }, description: 'Product search keywords' },
          limit: { type: 'number', description: 'Max products per source (default 30)' },
        },
        required: ['keywords'],
      }),
      handler: searchProductsHandler,
    },
    {
      spec: toolSpec('enrich_products', 'Generate AI descriptions and SEO metadata for selected products', {
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                price_usd: { type: 'number' },
                image: { type: 'string' },
                id: { type: 'string' },
              },
              required: ['name'],
            },
          },
          brand_name: { type: 'string', description: 'Brand name for consistent tone' },
          niche: { type: 'string', description: 'Product niche for context' },
        },
        required: ['products'],
      }),
      handler: enrichProductsHandler,
    },
    {
      spec: toolSpec('generate_site_content', 'Generate complete site content: brand identity, hero section, about page, policies', {
        properties: {
          niche: { type: 'string', description: 'E.g. "montres luxe homme"' },
          market: { type: 'string', enum: ['FR', 'EU', 'US'], description: 'Target market' },
          positioning: { type: 'string', enum: ['budget', 'mid', 'premium'] },
          top_product_names: { type: 'array', items: { type: 'string' }, description: 'Names of top products for hero context' },
        },
        required: ['niche'],
      }),
      handler: generateSiteContentHandler,
    },
    {
      spec: toolSpec('create_shop', 'Create and deploy a complete shop with products, content, and Stripe checkout', {
        properties: {
          name: { type: 'string', description: 'Shop display name' },
          slug: { type: 'string', description: 'URL-safe slug (lowercase, hyphens)' },
          port: { type: 'number', description: 'Port 3101-3199' },
          design_system: { type: 'string', description: 'Design system ID (swiss, cyber, radical, etc.)' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                cost_cents: { type: 'number' },
                images: { type: 'array', items: { type: 'string' } },
                seo_title: { type: 'string' },
                seo_description: { type: 'string' },
                category: { type: 'string' },
                supplier: { type: 'string' },
                external_id: { type: 'string' },
              },
              required: ['title'],
            },
          },
          site_content: { type: 'object', description: 'Full site content from generate_site_content' },
        },
        required: ['name', 'slug', 'products'],
      }),
      handler: createShopHandler,
    },
    {
      spec: toolSpec('check_health', 'Check if a deployed site is responding', {
        properties: {
          url: { type: 'string', description: 'Full URL to check' },
        },
        required: ['url'],
      }),
      handler: checkHealthHandler,
    },
    {
      spec: toolSpec('create_google_ads_campaign', 'Create a Google Ads search campaign plan for the shop', {
        properties: {
          shop_url: { type: 'string', description: 'Landing page URL' },
          daily_budget_eur: { type: 'number', description: 'Daily budget in EUR' },
          keywords: { type: 'array', items: { type: 'string' }, description: 'Target keywords' },
          headlines: { type: 'array', items: { type: 'string' }, description: 'Up to 15 ad headlines (max 30 chars each)' },
          descriptions: { type: 'array', items: { type: 'string' }, description: 'Up to 4 ad descriptions (max 90 chars each)' },
        },
        required: ['shop_url', 'keywords', 'headlines', 'descriptions'],
      }),
      handler: createGoogleAdsHandler,
    },
    {
      spec: toolSpec('create_meta_ads_campaign', 'Create a Meta (Facebook/Instagram) ads campaign plan', {
        properties: {
          shop_url: { type: 'string', description: 'Website URL' },
          daily_budget_eur: { type: 'number', description: 'Daily budget in EUR' },
          target_interests: { type: 'array', items: { type: 'string' }, description: 'Audience interests for targeting' },
          ad_copy: { type: 'string', description: 'Primary ad text (125 chars recommended)' },
        },
        required: ['shop_url', 'target_interests', 'ad_copy'],
      }),
      handler: createMetaAdsHandler,
    },
    {
      spec: toolSpec('run_seo_audit', 'Run a basic SEO audit on a deployed site', {
        properties: {
          url: { type: 'string', description: 'Site URL to audit' },
        },
        required: ['url'],
      }),
      handler: runSeoAuditHandler,
    },
  ];
}

export function getToolSpecs(registry: ToolDefinition[]): ChatCompletionTool[] {
  return registry.map(t => t.spec);
}

export function getToolHandler(registry: ToolDefinition[], name: string): ToolDefinition['handler'] | undefined {
  return registry.find(t => t.spec.function.name === name)?.handler;
}
