import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { trackedMessage } from './anthropic';
import { extractJson } from './json';

/**
 * Ad copy fan-out per product.
 *
 * For each product the agent emits 3 ad variants — one tuned for Meta
 * feed, one for TikTok in-feed / Reels, one for Google Search / Demand
 * Gen. Each variant carries the channel-specific shape (headline length,
 * primary text length, CTA) so the founder copy-pastes straight into the
 * ad manager without rework.
 *
 * Visuals are NOT re-rendered here — the mono-asset pipeline already
 * produced hero / cutout / lifestyle / promo URLs in R2 from
 * `dropship_stores.{hero,cutout,lifestyle,promo}_image_url`. The admin UI
 * lists those side-by-side with the hook variants.
 *
 * Cost: ~1.5K input + ~1K output tokens via Haiku 4.5 = ~0.0014 € per
 * product. Logged in dropship_ai_runs via trackedMessage.
 */

export type AdChannel = 'meta' | 'tiktok' | 'google';

export interface AdVariant {
  id: string;
  storeId: string;
  productId: string;
  batchId: string;
  channel: AdChannel;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string | null;
  createdAt: string;
}

export interface AdVariantInput {
  storeId: string;
  storeName: string;
  productId: string;
  productTitle: string;
  productDescription: string;
  niche: string;
  language?: 'fr' | 'en';
}

const SYSTEM_PROMPT_FR = `Tu es un copywriter direct response qui écrit des hooks d'ads pour le e-commerce. Tu écris en français, voix native, pas de calques anglais. Tu évites les tirets cadratins (—), les triades rythmiques de type "vite, simple, efficace", et tout ce qui sent l'IA générique. Tu privilégies les hooks courts, concrets, orientés bénéfice ou friction du client.`;

const SYSTEM_PROMPT_EN = `You are a direct-response copywriter for e-commerce. Native English voice, short concrete hooks centered on customer benefit or friction. Avoid em-dashes, generic AI tells, three-beat triads. Each hook is platform-specific.`;

interface ClaudeAdsResponse {
  variants: Array<{
    channel: AdChannel;
    headline: string;
    primary_text: string;
    description?: string | null;
    cta?: string | null;
  }>;
}

export async function generateAdVariants(input: AdVariantInput): Promise<AdVariant[]> {
  const language = input.language ?? 'fr';
  const system = language === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;

  const userPrompt = language === 'fr'
    ? buildUserPromptFr(input)
    : buildUserPromptEn(input);

  const response = await trackedMessage(
    { storeId: input.storeId, step: 'ad-variants' },
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    },
  );

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<ClaudeAdsResponse>(text);
  if (!parsed?.variants?.length) {
    throw new Error('Claude returned no ad variants');
  }

  const batchId = randomUUID();
  const db = getDb();
  const inserted: AdVariant[] = [];

  for (const v of parsed.variants) {
    if (!v.channel || !v.headline || !v.primary_text) continue;
    if (!['meta', 'tiktok', 'google'].includes(v.channel)) continue;

    const res = await db.query<{ id: string; created_at: string }>(
      `INSERT INTO dropship_ad_variants
        (store_id, product_id, batch_id, channel, headline, primary_text, description, cta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        input.storeId,
        input.productId,
        batchId,
        v.channel,
        v.headline.slice(0, 200),
        v.primary_text.slice(0, 600),
        v.description?.slice(0, 200) ?? null,
        v.cta?.slice(0, 40) ?? null,
      ],
    );

    inserted.push({
      id: res.rows[0]!.id,
      storeId: input.storeId,
      productId: input.productId,
      batchId,
      channel: v.channel,
      headline: v.headline.slice(0, 200),
      primaryText: v.primary_text.slice(0, 600),
      description: v.description?.slice(0, 200) ?? null,
      cta: v.cta?.slice(0, 40) ?? null,
      createdAt: res.rows[0]!.created_at,
    });
  }

  return inserted;
}

function buildUserPromptFr(input: AdVariantInput): string {
  return `Niche: ${input.niche}
Marque: ${input.storeName}
Produit: ${input.productTitle}
Description marchande (référence): ${input.productDescription.slice(0, 800)}

Écris 3 variantes d'ad copy, une par canal:

1. **Meta** (Facebook / Instagram feed)
   - headline: 25-40 chars, accroche émotionnelle ou bénéfice
   - primary_text: 90-140 chars, friction client + résolution + CTA implicite
   - description: 25-30 chars, complément utilitaire (livraison, garantie)
   - cta: parmi "Acheter", "Découvrir", "En savoir plus"

2. **TikTok** (in-feed natif, ton oral)
   - headline: 30-40 chars, hook qui se lit comme une phrase parlée
   - primary_text: 60-100 chars, format "POV" ou "moment où" ou question directe
   - description: null
   - cta: parmi "Acheter", "Voir le produit", "Découvrir"

3. **Google** (Demand Gen / Performance Max headline asset)
   - headline: 30 chars max, keyword-rich
   - primary_text: 90 chars max, description courte
   - description: 60 chars max, deuxième description
   - cta: null

Retourne UNIQUEMENT ce JSON, pas de prose autour:

{
  "variants": [
    { "channel": "meta",   "headline": "...", "primary_text": "...", "description": "...", "cta": "..." },
    { "channel": "tiktok", "headline": "...", "primary_text": "...", "description": null,    "cta": "..." },
    { "channel": "google", "headline": "...", "primary_text": "...", "description": "...", "cta": null   }
  ]
}`;
}

function buildUserPromptEn(input: AdVariantInput): string {
  return `Niche: ${input.niche}
Brand: ${input.storeName}
Product: ${input.productTitle}
Reference description: ${input.productDescription.slice(0, 800)}

Write 3 ad copy variants, one per channel:

1. **Meta**: headline 25-40 chars, primary_text 90-140 chars (problem → solution), description 25-30 chars, cta in {"Shop now","Learn more","Discover"}.
2. **TikTok**: headline 30-40 chars (spoken-style hook), primary_text 60-100 chars ("POV", "the moment when", direct question), description null, cta in {"Shop","See product","Learn more"}.
3. **Google**: headline 30 chars max keyword-rich, primary_text 90 chars max, description 60 chars max, cta null.

Return ONLY this JSON, no surrounding prose:

{
  "variants": [
    { "channel": "meta",   "headline": "...", "primary_text": "...", "description": "...", "cta": "..." },
    { "channel": "tiktok", "headline": "...", "primary_text": "...", "description": null,    "cta": "..." },
    { "channel": "google", "headline": "...", "primary_text": "...", "description": "...", "cta": null   }
  ]
}`;
}

