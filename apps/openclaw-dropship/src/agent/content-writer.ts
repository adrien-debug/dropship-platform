import OpenAI from 'openai';
import type { BrandIdentity, SiteContent, EnrichedProduct } from './types.js';

const VLLM_URL = process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_FAST_URL = process.env['VLLM_GPU1_FAST_URL'] ?? 'http://100.88.191.49:8001/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] ?? 'not-needed';
const VLLM_MODEL = process.env['VLLM_MODEL'] ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
const VLLM_FAST_MODEL = process.env['VLLM_FAST_MODEL'] ?? 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ';

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
        console.warn(`[opencore:retry] ${label} attempt ${i + 1}/${attempts} failed, retry in ${wait}ms: ${lastError.message}`);
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

function llm(fast = false): OpenAI {
  return new OpenAI({
    baseURL: fast ? VLLM_FAST_URL : VLLM_URL,
    apiKey: VLLM_API_KEY,
  });
}

async function jsonCompletion<T>(prompt: string, userMsg: string, fast = false, maxTokens = 512): Promise<T> {
  return withRetry(async () => {
    const client = llm(fast);
    const res = await client.chat.completions.create({
      model: fast ? VLLM_FAST_MODEL : VLLM_MODEL,
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
  }, { attempts: 3, delayMs: 1500, label: `json:${prompt.slice(0, 40)}` });
}

async function textCompletion(prompt: string, userMsg: string, maxTokens = 1024): Promise<string> {
  return withRetry(async () => {
    const client = llm();
    const res = await client.chat.completions.create({
      model: VLLM_MODEL,
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
  console.log(`[opencore:content] Generating site content for niche: ${input.niche}`);

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

  console.log(`[opencore:content] Brand: ${combined.brand.name} — ${combined.brand.tagline} (${Date.now() - t0}ms)`);

  // Call 2 (32B): about page — quality long-form text
  const aboutHtml = await textCompletion(
    `You write "About Us" pages for e-commerce stores. Write 150-250 words in simple HTML (<p>, <h2>, <strong>). Authentic, builds trust, reflects brand values. No lorem ipsum.`,
    `Brand: ${combined.brand.name}\nTagline: ${combined.brand.tagline}\nTone: ${combined.brand.tone_of_voice}\nNiche: ${input.niche}`,
    600,
  );

  console.log(`[opencore:content] Site content complete in ${Date.now() - t0}ms`);

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
    console.error(`[opencore:content] Enrich fallback for "${product.name}": ${err instanceof Error ? err.message : err}`);
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
  console.log(`[opencore:content] Enriching ${products.length} products for "${brandName}" (batch size: ${BATCH_SIZE})`);

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

  console.log(`[opencore:content] Enriched ${products.length} products in ${((Date.now() - t0) / 1000).toFixed(1)}s (${fallbackCount} fallbacks)`);
  return enriched;
}
