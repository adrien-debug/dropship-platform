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
    `Tu es un expert en branding e-commerce. Genere une identite de marque pour une boutique en ligne.
Retourne un JSON avec: name (nom de marque court, memorable, 1-2 mots), tagline (slogan accrocheur en francais, max 8 mots), tone_of_voice (style redactionnel: "luxe", "decontracte", "expert", etc.), color_mood (humeur de couleur: "sombre et elegant", "vif et energique", etc.)`,
    `Niche: ${niche}\nMarche cible: ${market}\nPositionnement: ${positioning}`,
    true,
  );
}

export async function generateHeroSection(
  brand: BrandIdentity, topProducts: string[]
): Promise<{ hero_title: string; hero_subtitle: string; hero_cta: string }> {
  return jsonCompletion(
    `Tu crees des sections hero pour des sites e-commerce. Retourne un JSON avec:
hero_title (titre principal, max 6 mots, impactant),
hero_subtitle (sous-titre, max 20 mots, evoque la valeur),
hero_cta (texte du bouton CTA, max 4 mots, action-oriented)`,
    `Marque: ${brand.name}\nTagline: ${brand.tagline}\nTon: ${brand.tone_of_voice}\nProduits phares: ${topProducts.join(', ')}`,
    true,
  );
}

export async function generateAboutPage(brand: BrandIdentity, niche: string): Promise<string> {
  return textCompletion(
    `Tu rediges des pages "A propos" pour des boutiques e-commerce francaises. Ecris un texte engageant de 150-250 mots en HTML simple (utilise <p>, <h2>, <strong>). Le texte doit etre authentique, inspirer confiance, et refleter les valeurs de la marque. Pas de lorem ipsum.`,
    `Marque: ${brand.name}\nSlogan: ${brand.tagline}\nTon: ${brand.tone_of_voice}\nNiche: ${niche}`,
    800,
  );
}

export async function generatePolicies(market: string): Promise<{ shipping: string; returns: string }> {
  return jsonCompletion(
    `Tu rediges des politiques e-commerce conformes au droit ${market === 'FR' ? 'francais' : 'europeen'}.
Retourne un JSON avec:
shipping (politique de livraison en HTML, ~100 mots, delais, frais, zones),
returns (politique de retours en HTML, ~100 mots, delai 14 jours legal, conditions, remboursement)`,
    `Marche: ${market}. Dropshipping avec livraison 7-15 jours ouvrables. Retours acceptes sous 14 jours conformement au droit de retractation ${market === 'FR' ? 'francais' : 'europeen'}.`,
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
      `Genere les meta SEO pour un site e-commerce. JSON avec: seo_title (max 60 chars), seo_description (max 160 chars), seo_keywords (array 5-10 mots-cles en francais).`,
      `Marque: ${brand.name}\nNiche: ${input.niche}\nMarche: ${input.market}`,
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
  console.log(`[content-writer] Enriching ${products.length} products for "${brandName}"`);

  const enriched: EnrichedProduct[] = [];

  for (const product of products) {
    try {
      const [desc, seo] = await Promise.all([
        textCompletion(
          `Tu es le copywriter de "${brandName}", boutique specialisee en ${niche}. Ecris une description produit e-commerce en francais, 80-120 mots, engageante, qui met en valeur les avantages. Pas de repetition du titre.`,
          `Produit: ${product.name}\nCategorie: ${product.category}\nPrix: ${(product.costCents / 100 * 2.5).toFixed(2)} EUR`,
          300,
        ),
        jsonCompletion<{ title: string; description: string; keywords: string[] }>(
          `Genere les meta SEO pour un produit e-commerce. JSON avec: title (max 60 chars), description (max 160 chars), keywords (array 3-5 mots). Francais.`,
          `Produit: ${product.name}\nCategorie: ${product.category}`,
          true,
        ),
      ]);

      const sellingPrice = Math.round(product.costCents * 2.5) / 100;

      enriched.push({
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
      });
    } catch (err) {
      console.error(`[content-writer] Failed to enrich "${product.name}":`, err instanceof Error ? err.message : err);
      enriched.push({
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
      });
    }

    await new Promise(r => setTimeout(r, 150));
  }

  return enriched;
}
