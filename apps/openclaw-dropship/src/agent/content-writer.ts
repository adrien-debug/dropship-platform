import OpenAI from 'openai';
import type { BrandIdentity, SiteContent, EnrichedProduct } from './types.js';

const VLLM_URL = process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_FAST_URL = process.env['VLLM_GPU1_FAST_URL'] ?? 'http://100.88.191.49:8001/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] ?? 'not-needed';
const VLLM_MODEL = process.env['VLLM_MODEL'] ?? 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
const VLLM_FAST_MODEL = process.env['VLLM_FAST_MODEL'] ?? 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ';

function llm(fast = false): OpenAI {
  return new OpenAI({
    baseURL: fast ? VLLM_FAST_URL : VLLM_URL,
    apiKey: VLLM_API_KEY,
  });
}

async function jsonCompletion<T>(prompt: string, userMsg: string, fast = false): Promise<T> {
  const client = llm(fast);
  const res = await client.chat.completions.create({
    model: fast ? VLLM_FAST_MODEL : VLLM_MODEL,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 2048,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const raw = res.choices[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error('[content-writer] JSON parse failed:', raw.slice(0, 200));
    return {} as T;
  }
}

async function textCompletion(prompt: string, userMsg: string, maxTokens = 1024): Promise<string> {
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
  return res.choices[0]?.message?.content ?? '';
}

export async function generateBrandIdentity(
  niche: string, market: string, positioning: string
): Promise<BrandIdentity> {
  return jsonCompletion<BrandIdentity>(
    `You are an expert e-commerce branding strategist. Generate a brand identity for an online store.
Return JSON with: name (short memorable brand name, 1-2 words), tagline (catchy slogan, max 8 words), tone_of_voice (writing style: "luxury", "casual", "expert", etc.), color_mood (color mood: "dark and elegant", "bright and energetic", etc.)`,
    `Niche: ${niche}\nTarget market: ${market}\nPositioning: ${positioning}`,
    true,
  );
}

export async function generateHeroSection(
  brand: BrandIdentity, topProducts: string[]
): Promise<{ hero_title: string; hero_subtitle: string; hero_cta: string }> {
  return jsonCompletion(
    `You create hero sections for e-commerce websites. Return JSON with:
hero_title (main headline, max 6 words, impactful),
hero_subtitle (subtitle, max 20 words, conveys value),
hero_cta (CTA button text, max 4 words, action-oriented)`,
    `Brand: ${brand.name}\nTagline: ${brand.tagline}\nTone: ${brand.tone_of_voice}\nTop products: ${topProducts.join(', ')}`,
    true,
  );
}

export async function generateAboutPage(brand: BrandIdentity, niche: string): Promise<string> {
  return textCompletion(
    `You write "About Us" pages for e-commerce stores. Write an engaging 150-250 word text in simple HTML (use <p>, <h2>, <strong>). The text should be authentic, build trust, and reflect the brand values. No lorem ipsum.`,
    `Brand: ${brand.name}\nTagline: ${brand.tagline}\nTone: ${brand.tone_of_voice}\nNiche: ${niche}`,
    800,
  );
}

export async function generatePolicies(market: string): Promise<{ shipping: string; returns: string }> {
  return jsonCompletion(
    `You write e-commerce store policies. Return JSON with:
shipping (shipping policy in HTML, ~100 words, delivery times, fees, zones),
returns (return policy in HTML, ~100 words, 14-day return window, conditions, refund process)`,
    `Market: ${market}. Dropshipping with 7-15 business days delivery. Returns accepted within 14 days.`,
    true,
  );
}

export async function generateSiteContent(input: {
  niche: string;
  market: string;
  positioning: string;
  topProducts: string[];
}): Promise<SiteContent> {
  console.log(`[content-writer] Generating site content for niche: ${input.niche}`);

  const [brand, policies] = await Promise.all([
    generateBrandIdentity(input.niche, input.market, input.positioning),
    generatePolicies(input.market),
  ]);

  console.log(`[content-writer] Brand: ${brand.name} — ${brand.tagline}`);

  const [hero, aboutHtml, seo] = await Promise.all([
    generateHeroSection(brand, input.topProducts),
    generateAboutPage(brand, input.niche),
    jsonCompletion<{ seo_title: string; seo_description: string; seo_keywords: string[] }>(
      `Generate SEO metadata for an e-commerce website. JSON with: seo_title (max 60 chars), seo_description (max 160 chars), seo_keywords (array of 5-10 keywords).`,
      `Brand: ${brand.name}\nNiche: ${input.niche}\nMarket: ${input.market}`,
      true,
    ),
  ]);

  return {
    brand,
    hero_title: hero.hero_title,
    hero_subtitle: hero.hero_subtitle,
    hero_cta: hero.hero_cta,
    about_html: aboutHtml,
    shipping_policy: policies.shipping,
    return_policy: policies.returns,
    seo_title: seo.seo_title ?? brand.name,
    seo_description: seo.seo_description ?? brand.tagline,
    seo_keywords: seo.seo_keywords ?? [],
  };
}

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
  try {
    const [desc, seo] = await Promise.all([
      textCompletion(
        `You are the copywriter for "${brandName}", a store specializing in ${niche}. Write an e-commerce product description, 80-120 words, engaging, highlighting benefits. Do not repeat the title.`,
        `Product: ${product.name}\nCategory: ${product.category}\nPrice: $${(product.costCents / 100 * 2.5).toFixed(2)}`,
        300,
      ),
      jsonCompletion<{ title: string; description: string; keywords: string[] }>(
        `Generate SEO metadata for an e-commerce product. JSON with: title (max 60 chars), description (max 160 chars), keywords (array of 3-5 terms).`,
        `Product: ${product.name}\nCategory: ${product.category}`,
        true,
      ),
    ]);

    const sellingPrice = Math.round(product.costCents * 2.5) / 100;

    return {
      title: product.name,
      description: desc,
      price: sellingPrice,
      cost_cents: product.costCents,
      images: product.image ? [product.image] : [],
      seo_title: seo.title ?? product.name,
      seo_description: seo.description ?? '',
      category: product.category,
      supplier: 'cj',
      external_id: product.externalId ?? '',
    };
  } catch (err) {
    console.error(`[content-writer] Failed to enrich "${product.name}":`, err instanceof Error ? err.message : err);
    return {
      title: product.name,
      description: '',
      price: Math.round(product.costCents * 2.5) / 100,
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
  const startTime = Date.now();
  const BATCH_SIZE = 5;
  
  console.log(`[content-writer] Enriching ${products.length} products for "${brandName}" (batch size: ${BATCH_SIZE})`);

  const enriched: EnrichedProduct[] = [];
  let failedCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(product => enrichSingleProduct(product, brandName, niche))
    );
    
    failedCount += batchResults.filter(r => !r.description).length;
    enriched.push(...batchResults);
    
    if (i + BATCH_SIZE < products.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[content-writer] Enriched ${products.length} products in ${(duration / 1000).toFixed(1)}s (${failedCount} fallbacks)`);

  return enriched;
}
