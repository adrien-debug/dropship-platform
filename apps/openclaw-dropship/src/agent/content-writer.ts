import OpenAI from 'openai';
import type { BrandIdentity, SiteContent, EnrichedProduct } from './types.js';
import { logger } from '../logger.js';

const LLM_MODE = process.env['LLM_MODE'] ?? 'auto';
const VLLM_URL = process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_FAST_URL = process.env['VLLM_GPU1_FAST_URL'] ?? 'http://100.88.191.49:8001/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] ?? 'not-needed';
const VLLM_MODEL = process.env['VLLM_MODEL'] ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
const VLLM_FAST_MODEL = process.env['VLLM_FAST_MODEL'] ?? 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ';
const FALLBACK_MODEL = process.env['LLM_FALLBACK_MODEL']?.trim() || 'gpt-4o-mini';

function isLocalMode(): boolean {
  return LLM_MODE === 'local';
}

export type LLMClientBundle = {
  vllm: OpenAI;
  vllmFast: OpenAI;
  openaiFallback?: OpenAI;
  fallbackModel: string;
};

let llmClientBundle: LLMClientBundle | undefined;

/** Primary vLLM clients + optional OpenAI cloud fallback when OPENAI_API_KEY is set. */
export function createLLMClient(config?: { vllmBaseUrl?: string; vllmFastBaseUrl?: string }): LLMClientBundle {
  const main = config?.vllmBaseUrl ?? VLLM_URL;
  const fast =
    config?.vllmFastBaseUrl ?? (config?.vllmBaseUrl ? config.vllmBaseUrl : VLLM_FAST_URL);
  const key = process.env['OPENAI_API_KEY']?.trim();
  const openaiFallback = key ? new OpenAI({ apiKey: key }) : undefined;
  return {
    vllm: new OpenAI({ baseURL: main, apiKey: VLLM_API_KEY }),
    vllmFast: new OpenAI({ baseURL: fast, apiKey: VLLM_API_KEY }),
    openaiFallback,
    fallbackModel: FALLBACK_MODEL,
  };
}

function getLLMClientBundle(): LLMClientBundle {
  if (!llmClientBundle) llmClientBundle = createLLMClient();
  return llmClientBundle;
}

/** True when the error looks like vLLM/network unavailability (retry with cloud if configured). */
export function isVllmUnreachableError(err: unknown): boolean {
  if (err == null) return false;
  const e = err as Error & { cause?: { code?: string }; code?: string; status?: number };
  const code = e.cause?.code ?? e.code;
  const transportCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'];
  if (code && transportCodes.includes(String(code))) return true;
  const status = e.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = String(e.message ?? err).toLowerCase();
  if (
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('connect timeout') ||
    msg.includes('socket hang up') ||
    msg.includes('network error')
  ) {
    return true;
  }
  return false;
}

const PRICE_MULTIPLIER = 2.5;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

// ─── OpenCore: Retry with exponential backoff ───

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  const { attempts = 3, delayMs = 1000, label = 'operation' } = opts;
  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < attempts - 1) {
        const wait = delayMs * Math.pow(2, i);
        logger.warn('retry', `${label} attempt ${i + 1}/${attempts} failed, retry in ${wait}ms: ${lastError.message}`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  throw lastError!;
}

// ─── OpenCore: Robust JSON extraction from LLM output ───

export function extractJSON<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T; } catch {}

  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) as T; } catch {}
  }

  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    try { return JSON.parse(brace[0]) as T; } catch {}
  }

  return null;
}

// ─── LLM clients ───

async function jsonCompletion<T>(prompt: string, userMsg: string, fast = false, maxTokens = 512): Promise<T> {
  const bundle = getLLMClientBundle();
  return withRetry(async () => {
    const run = async (cloud: boolean) => {
      const client = cloud
        ? bundle.openaiFallback!
        : fast
          ? bundle.vllmFast
          : bundle.vllm;
      const model = cloud ? bundle.fallbackModel : fast ? VLLM_FAST_MODEL : VLLM_MODEL;
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const raw = res.choices[0]?.message?.content ?? '';
      const parsed = extractJSON<T>(raw);

      if (!parsed || (typeof parsed === 'object' && Object.keys(parsed as object).length === 0)) {
        throw new Error(`LLM returned empty/unparseable JSON: ${raw.slice(0, 300)}`);
      }

      return parsed;
    };

    try {
      return await run(false);
    } catch (err) {
      if (bundle.openaiFallback && isVllmUnreachableError(err)) {
        logger.warn('llm', `vLLM unreachable, using OpenAI fallback (${bundle.fallbackModel})`);
        return await run(true);
      }
      throw err;
    }
  }, { attempts: 3, delayMs: 1500, label: `json:${prompt.slice(0, 40)}` });
}

async function textCompletion(prompt: string, userMsg: string, maxTokens = 1024): Promise<string> {
  const bundle = getLLMClientBundle();
  return withRetry(async () => {
    const run = async (cloud: boolean) => {
      const client = cloud ? bundle.openaiFallback! : bundle.vllm;
      const model = cloud ? bundle.fallbackModel : VLLM_MODEL;
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const content = res.choices[0]?.message?.content ?? '';
      if (!content.trim()) {
        throw new Error('LLM returned empty text');
      }
      return content;
    };

    try {
      return await run(false);
    } catch (err) {
      if (bundle.openaiFallback && isVllmUnreachableError(err)) {
        logger.warn('llm', `vLLM unreachable, using OpenAI fallback (${bundle.fallbackModel})`);
        return await run(true);
      }
      throw err;
    }
  }, { attempts: 2, delayMs: 1000, label: 'textCompletion' });
}

// ─── Content generators ───

type SiteContentJSON = {
  brand: BrandIdentity;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  shipping_policy: string;
  return_policy: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
};

export async function generateSiteContent(input: {
  niche: string;
  market: string;
  positioning: string;
  topProducts: string[];
}): Promise<SiteContent> {
  const t0 = Date.now();
  logger.info('content', `Generating site content for niche: ${input.niche} (mode: ${LLM_MODE})`);

  if (isLocalMode()) {
    return localSiteContent(input.niche, input.market, input.positioning);
  }

  // Call 1 (fast model): brand + hero + policies + SEO in a single JSON call
  const combined = await jsonCompletion<SiteContentJSON>(
    `You are an expert e-commerce strategist. Generate complete site content for an online store.
Return JSON with exactly these keys:
- brand: { name (1-2 words), tagline (max 8 words), tone_of_voice, color_mood }
- hero_title (max 6 words, impactful), hero_subtitle (max 20 words), hero_cta (max 4 words)
- shipping_policy (HTML ~80 words, dropshipping 7-15 business days)
- return_policy (HTML ~80 words, 14-day return window)
- seo_title (max 60 chars), seo_description (max 160 chars), seo_keywords (array 5-8)`,
    `Niche: ${input.niche}\nMarket: ${input.market}\nPositioning: ${input.positioning}\nTop products: ${input.topProducts.slice(0, 5).join(', ')}`,
    true,
    900,
  );

  logger.info('content', `Brand: ${combined.brand.name} — ${combined.brand.tagline} (${Date.now() - t0}ms)`);

  // Call 2 (32B): about page — quality long-form text
  const aboutHtml = await textCompletion(
    `You write "About Us" pages for e-commerce stores. Write 150-250 words in simple HTML (<p>, <h2>, <strong>). Authentic, builds trust, reflects brand values. No lorem ipsum.`,
    `Brand: ${combined.brand.name}\nTagline: ${combined.brand.tagline}\nTone: ${combined.brand.tone_of_voice}\nNiche: ${input.niche}`,
    600,
  );

  logger.info('content', `Site content complete in ${Date.now() - t0}ms`);

  return {
    brand: combined.brand,
    hero_title: combined.hero_title,
    hero_subtitle: combined.hero_subtitle,
    hero_cta: combined.hero_cta,
    about_html: aboutHtml,
    shipping_policy: combined.shipping_policy,
    return_policy: combined.return_policy,
    seo_title: combined.seo_title ?? combined.brand.name,
    seo_description: combined.seo_description ?? combined.brand.tagline,
    seo_keywords: combined.seo_keywords ?? [],
  };
}

// ─── Product enrichment ───

async function enrichSingleProduct(
  product: {
    name: string;
    category: string;
    costCents: number;
    image?: string;
    externalId?: string;
  },
  brandName: string,
  niche: string,
): Promise<EnrichedProduct> {
  const sellingPrice = Math.round(product.costCents * PRICE_MULTIPLIER) / 100;

  try {
    // Single call (fast model): description + SEO merged
    const result = await jsonCompletion<{
      description: string;
      seo_title: string;
      seo_description: string;
    }>(
      `You are the copywriter for "${brandName}", a ${niche} store. Return JSON with:
- description: 80-120 word product description, engaging, benefits-focused, no title repeat
- seo_title: max 60 chars
- seo_description: max 160 chars`,
      `Product: ${product.name}\nCategory: ${product.category}\nPrice: $${sellingPrice.toFixed(2)}`,
      true,
      350,
    );

    return {
      title: product.name,
      description: result.description ?? '',
      price: sellingPrice,
      cost_cents: product.costCents,
      images: product.image ? [product.image] : [],
      seo_title: result.seo_title ?? product.name,
      seo_description: result.seo_description ?? '',
      category: product.category,
      supplier: 'cj',
      external_id: product.externalId ?? '',
    };
  } catch (err) {
    logger.error('content', `Enrich fallback for "${product.name}": ${err instanceof Error ? err.message : err}`);
    return {
      title: product.name,
      description: '',
      price: sellingPrice,
      cost_cents: product.costCents,
      images: product.image ? [product.image] : [],
      seo_title: product.name,
      seo_description: '',
      category: product.category,
      supplier: 'cj',
      external_id: product.externalId ?? '',
    };
  }
}

export async function generateProductDescriptions(
  products: Array<{
    name: string;
    category: string;
    costCents: number;
    image?: string;
    externalId?: string;
  }>,
  brandName: string,
  niche: string,
): Promise<EnrichedProduct[]> {
  const t0 = Date.now();
  logger.info('content', `Enriching ${products.length} products for "${brandName}" (mode: ${LLM_MODE})`);

  if (isLocalMode()) {
    return products.map(p => localEnrichProduct(p, brandName));
  }

  const enriched: EnrichedProduct[] = [];
  let fallbackCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(product => enrichSingleProduct(product, brandName, niche)),
    );

    fallbackCount += batchResults.filter(r => !r.description).length;
    enriched.push(...batchResults);

    if (i + BATCH_SIZE < products.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  logger.info('content', `Enriched ${products.length} products in ${((Date.now() - t0) / 1000).toFixed(1)}s (${fallbackCount} fallbacks)`);
  return enriched;
}

// ─── Local mode: deterministic content without any LLM ───

function localSiteContent(niche: string, market: string, positioning: string): SiteContent {
  const primary = niche.split(',')[0]?.trim() ?? niche;
  const cap = primary.charAt(0).toUpperCase() + primary.slice(1);
  const region = market === 'US' ? 'the US' : market === 'EU' ? 'Europe' : 'France';
  const tier = positioning === 'premium' ? 'Premium' : positioning === 'budget' ? 'Affordable' : 'Quality';

  logger.info('content', `[local] Generated site content for "${primary}" (${market}/${positioning})`);

  return {
    brand: {
      name: `${cap} Hub`,
      tagline: `${tier} ${primary} delivered to you`,
      tone_of_voice: positioning === 'premium' ? 'refined and confident' : 'friendly and direct',
      color_mood: positioning === 'premium' ? 'dark and elegant' : 'clean and bright',
    },
    hero_title: `${tier} ${cap}`,
    hero_subtitle: `Discover our curated selection of ${primary} products, handpicked for ${region}.`,
    hero_cta: 'Shop Now',
    about_html: [
      `<h2>About ${cap} Hub</h2>`,
      `<p>We are a ${positioning}-tier ${primary} store serving ${region}. `,
      `Our team carefully selects each product for quality, design, and value.</p>`,
      `<p>Fast shipping, easy returns, and dedicated customer support — that's our promise.</p>`,
    ].join(''),
    shipping_policy: `<p>Standard shipping: 7-15 business days to ${region}. Free shipping on orders over €50. Express options available at checkout.</p>`,
    return_policy: '<p>14-day satisfaction guarantee. Return unused items in original packaging for a full refund. Contact support to start a return.</p>',
    seo_title: `${cap} Hub — ${tier} ${primary} Online`,
    seo_description: `Shop ${positioning}-range ${primary} products online. Curated selection, fast shipping to ${region}. Satisfaction guaranteed.`,
    seo_keywords: niche.split(',').map(k => k.trim()).filter(Boolean),
  };
}

function localEnrichProduct(
  product: { name: string; category: string; costCents: number; image?: string; externalId?: string },
  brandName: string,
): EnrichedProduct {
  const sellingPrice = Math.round(product.costCents * PRICE_MULTIPLIER) / 100;
  return {
    title: product.name,
    description: `${product.name} from ${brandName}. A quality ${product.category.toLowerCase()} product, carefully selected for our customers. Order now and enjoy fast, reliable shipping.`,
    price: sellingPrice,
    cost_cents: product.costCents,
    images: product.image ? [product.image] : [],
    seo_title: `${product.name} | ${brandName}`,
    seo_description: `Buy ${product.name} — ${product.category}. ${brandName} quality, fast shipping.`,
    category: product.category,
    supplier: 'cj',
    external_id: product.externalId ?? '',
  };
}
