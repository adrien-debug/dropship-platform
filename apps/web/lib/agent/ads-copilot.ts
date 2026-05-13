/**
 * Ads copilot tool library — used by copilot-router.ts (Ads mode).
 *
 * Tool surface: list variants, rewrite hook, generate visual (fal.ai),
 * suggest targeting, estimate budget.
 * The turn loop and session persistence live in copilot-router.ts.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { trackedMessage } from './anthropic';
import { extractJson } from './json';
import { falGenerateImage } from './fal-client';
import { uploadToR2, isR2Configured } from '@/lib/storage/r2';

const ADS_MODEL = 'claude-sonnet-4-6';

// ── Tool schemas ────────────────────────────────────────────────────────

const ListVariantsInput = z.object({}).strict();
const ListProductsInput = z.object({}).strict();

const RewriteHookInput = z.object({
  variant_id: z.string().uuid(),
  instruction: z.string().min(2).max(500),
});

const GenerateVisualInput = z.object({
  variant_id: z.string().uuid(),
  prompt: z.string().min(2).max(500).optional(),
});

const SuggestTargetingInput = z.object({
  product_id: z.string().uuid(),
  channel: z.enum(['meta', 'tiktok', 'google']),
});

const EstimateBudgetInput = z.object({
  product_id: z.string().uuid(),
  daily_budget_eur: z.number().positive().max(10_000),
  days: z.number().int().positive().max(90),
  channel: z.enum(['meta', 'tiktok', 'google']).optional(),
});

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_variants',
    description:
      "List every ad variant for this store, grouped by channel. Returns id, channel, hook (headline), primary text, CTA, image_url, and product title. Use this when the user references a hook vaguely.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_products',
    description:
      "List every product in this store so the user can pick one to target. Returns product_id, title, price, image_url.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'rewrite_hook',
    description:
      "Rewrite a single ad variant's hook/body/CTA per the user's instruction (e.g. 'plus agressif', 'plus émotionnel', 'version TikTok-native'). Updates dropship_ad_variants and returns the new copy.",
    input_schema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: 'UUID of dropship_ad_variants.' },
        instruction: { type: 'string' },
      },
      required: ['variant_id', 'instruction'],
    },
  },
  {
    name: 'generate_visual',
    description:
      'Generate a square 1:1 visual for an ad variant via fal.ai and upload to R2. Updates dropship_ad_variants.meta.image_url. Pass an optional `prompt`; otherwise it derives one from the headline + product title.',
    input_schema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['variant_id'],
    },
  },
  {
    name: 'suggest_targeting',
    description:
      "Derive a targeting JSON (age range, genders, interests, locations, placements, recommended daily budget) for a product on a given channel. Persists into dropship_ad_variants.targeting_json for each variant of that product on that channel.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        channel: { type: 'string', enum: ['meta', 'tiktok', 'google'] },
      },
      required: ['product_id', 'channel'],
    },
  },
  {
    name: 'estimate_budget',
    description:
      "Static CPM-based budget estimate. Given a product, daily budget (EUR) and number of days, return impressions / clicks / purchases bracket per channel.",
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string' },
        daily_budget_eur: { type: 'number' },
        days: { type: 'number' },
        channel: { type: 'string', enum: ['meta', 'tiktok', 'google'] },
      },
      required: ['product_id', 'daily_budget_eur', 'days'],
    },
  },
];

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

interface StoreContext {
  id: string;
  slug: string;
  name: string;
  niche: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function loadStore(storeId: string): Promise<StoreContext | null> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
  }>(
    `SELECT id, slug, name, niche
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, slug: r.slug, name: r.name, niche: r.niche };
}

async function loadHistory(sessionId: string): Promise<StoredMessage[]> {
  const db = getDb();
  const { rows } = await db.query<StoredMessage>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_curation_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows;
}

async function insertMessage(
  sessionId: string,
  msg: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO dropship_curation_messages
       (session_id, role, content, tool_name, tool_input, tool_output)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      sessionId,
      msg.role,
      msg.content,
      msg.toolName ?? null,
      msg.toolInput == null ? null : JSON.stringify(msg.toolInput),
      msg.toolOutput == null ? null : JSON.stringify(msg.toolOutput),
    ],
  );
  await db.query(
    `UPDATE dropship_curation_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

function rebuildMessages(
  history: StoredMessage[],
): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];
  let pendingToolUses: Array<{ id: string; name: string; input: unknown }> = [];
  let pendingAssistantText = '';

  const flushAssistant = () => {
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];
    if (pendingAssistantText.trim()) {
      blocks.push({ type: 'text', text: pendingAssistantText });
    }
    for (const tu of pendingToolUses) {
      blocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input ?? {} });
    }
    if (blocks.length) out.push({ role: 'assistant', content: blocks });
    pendingAssistantText = '';
    pendingToolUses = [];
  };

  for (const row of history) {
    if (row.role === 'user') {
      flushAssistant();
      out.push({ role: 'user', content: row.content });
    } else if (row.role === 'assistant') {
      flushAssistant();
      pendingAssistantText = row.content;
    } else if (row.role === 'tool') {
      const useId =
        row.tool_input && typeof row.tool_input === 'object' && '__tool_use_id' in row.tool_input
          ? String((row.tool_input as { __tool_use_id?: unknown }).__tool_use_id)
          : `toolu_${row.id}`;
      pendingToolUses.push({
        id: useId,
        name: row.tool_name ?? 'unknown',
        input: stripToolUseId(row.tool_input),
      });
      flushAssistant();
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: useId,
            content: stringifyToolOutput(row.tool_output),
            is_error: Boolean(
              row.tool_output &&
                typeof row.tool_output === 'object' &&
                'error' in (row.tool_output as Record<string, unknown>) &&
                (row.tool_output as { error?: unknown }).error,
            ),
          },
        ],
      });
    }
  }
  flushAssistant();
  return out;
}

function stripToolUseId(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input ?? {};
  const clone = { ...(input as Record<string, unknown>) };
  delete clone.__tool_use_id;
  return clone;
}

function stringifyToolOutput(out: unknown): string {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  try {
    return JSON.stringify(out);
  } catch {
    return String(out);
  }
}

function buildSystemPrompt(store: StoreContext): string {
  return [
    `You are a senior performance marketer embedded in the admin of "${store.name}" (niche: "${store.niche}").`,
    '',
    'Your job is to help the operator iterate ad creatives via tools:',
    '- list_variants / list_products: read state.',
    '- rewrite_hook: rewrite headline + body + CTA of a specific variant.',
    '- generate_visual: produce a 1:1 ad image via fal.ai (slow, ~30s).',
    '- suggest_targeting: derive age/gender/interests/placements for a product+channel.',
    '- estimate_budget: quick CPM-based forecast for a daily budget over N days.',
    '',
    'You are ONE mode of a multi-mode Copilote hub. NEVER tell the operator that a request is "outside your perimeter" or "needs a developer" without first checking if another mode of the hub can do it:',
    '- **Curation** : ajout/retrait/prix/copywriting des produits du store.',
    '- **Médias** : régénère les visuels du storefront (hero, cutout, lifestyles, vidéo).',
    '- **Recherche** : trouver une nouvelle niche.',
    '- **Dev** : édite le code source du site (Next.js + Tailwind). Use it for layout, color schemes, new components, hero refactor.',
    '',
    'If the request is outside ads (e.g. "change the storefront hero", "add a product"), name the right mode and invite the operator to switch via the pills at the top of /admin/stores/[id]/copilot.',
    '',
    'Rules:',
    '- Speak French by default (the operator is French). Switch to English only if they do.',
    '- When the user is vague, ask AT MOST one short clarifying question before acting.',
    "- Before rewriting or regenerating, surface what's about to change. Do not chain mutations across products without confirmation.",
    '- No em-dashes (—), no three-beat triads. Write tight, concrete French.',
    '- If a tool fails, surface the error in plain French and propose the next action.',
  ].join('\n');
}

// ── Tool executors ──────────────────────────────────────────────────────

interface ToolExecutionResult {
  output: unknown;
  summary: string;
  mutated?: boolean;
}

async function execListVariants(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  ListVariantsInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    product_id: string;
    product_title: string;
    channel: 'meta' | 'tiktok' | 'google';
    headline: string;
    primary_text: string;
    description: string | null;
    cta: string | null;
    meta: unknown;
    targeting_json: unknown;
    created_at: string;
  }>(
    `SELECT v.id, v.product_id, p.enriched_title AS product_title,
            v.channel, v.headline, v.primary_text, v.description, v.cta,
            v.meta, v.targeting_json, v.created_at
       FROM dropship_ad_variants v
       JOIN dropship_store_products p ON p.id = v.product_id
       WHERE v.store_id = $1
       ORDER BY v.created_at DESC`,
    [store.id],
  );

  const variants = rows.map((r) => ({
    variant_id: r.id,
    product_id: r.product_id,
    product_title: r.product_title,
    channel: r.channel,
    headline: r.headline,
    primary_text: r.primary_text,
    description: r.description,
    cta: r.cta,
    image_url: extractImageUrl(r.meta),
    targeting: r.targeting_json,
    created_at: r.created_at,
  }));

  const byChannel = {
    meta: variants.filter((v) => v.channel === 'meta'),
    tiktok: variants.filter((v) => v.channel === 'tiktok'),
    google: variants.filter((v) => v.channel === 'google'),
  };
  return {
    output: { variants, by_channel: byChannel, count: variants.length },
    summary: `${variants.length} variante${variants.length === 1 ? '' : 's'} (M:${byChannel.meta.length} T:${byChannel.tiktok.length} G:${byChannel.google.length})`,
  };
}

async function execListProducts(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  ListProductsInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    enriched_title: string;
    enriched_description: string;
    price_cents: number;
    image_url: string | null;
  }>(
    `SELECT id, enriched_title, enriched_description, price_cents, image_url
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC`,
    [store.id],
  );
  const products = rows.map((r) => ({
    product_id: r.id,
    title: r.enriched_title,
    description: r.enriched_description,
    price_cents: r.price_cents,
    image_url: r.image_url,
  }));
  return {
    output: { products },
    summary: `${products.length} produit${products.length === 1 ? '' : 's'}`,
  };
}

async function execRewriteHook(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  const input = RewriteHookInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    channel: 'meta' | 'tiktok' | 'google';
    headline: string;
    primary_text: string;
    description: string | null;
    cta: string | null;
    product_id: string;
    product_title: string;
    product_description: string;
  }>(
    `SELECT v.id, v.channel, v.headline, v.primary_text, v.description, v.cta,
            v.product_id, p.enriched_title AS product_title, p.enriched_description AS product_description
       FROM dropship_ad_variants v
       JOIN dropship_store_products p ON p.id = v.product_id
       WHERE v.id = $1 AND v.store_id = $2 LIMIT 1`,
    [input.variant_id, store.id],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Variante ${input.variant_id} introuvable dans ce store.`);
  }

  const response = await trackedMessage({ step: 'ads-rewrite-hook' }, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Tu es copywriter direct response pour ${store.niche}. Réécris cette variante d'ad selon: "${input.instruction}".

Canal: ${row.channel}
Produit: ${row.product_title}
Description produit (référence): ${row.product_description.slice(0, 400)}

Variante actuelle:
- headline: ${row.headline}
- primary_text: ${row.primary_text}
- description: ${row.description ?? ''}
- cta: ${row.cta ?? ''}

Règles:
- Français natif, pas de calques anglais.
- Pas de tiret cadratin (—), pas de triade rythmique.
- headline ≤ 80 caractères, primary_text ≤ 250 caractères.
- Adapte le ton au canal (TikTok = parlé, Meta = bénéfice, Google = keyword).

Retourne UNIQUEMENT ce JSON:
{"headline": "...", "primary_text": "...", "description": "...", "cta": "..."}`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<{
    headline?: string;
    primary_text?: string;
    description?: string | null;
    cta?: string | null;
  }>(text);
  if (!parsed || !parsed.headline || !parsed.primary_text) {
    throw new Error('Le modèle n’a pas renvoyé un JSON exploitable.');
  }

  const newHeadline = parsed.headline.slice(0, 200);
  const newPrimary = parsed.primary_text.slice(0, 600);
  const newDescription = parsed.description?.slice(0, 200) ?? null;
  const newCta = parsed.cta?.slice(0, 40) ?? null;

  await db.query(
    `UPDATE dropship_ad_variants
       SET headline = $1, primary_text = $2, description = $3, cta = $4
       WHERE id = $5`,
    [newHeadline, newPrimary, newDescription, newCta, row.id],
  );

  return {
    output: {
      variant_id: row.id,
      channel: row.channel,
      before: {
        headline: row.headline,
        primary_text: row.primary_text,
        description: row.description,
        cta: row.cta,
      },
      after: {
        headline: newHeadline,
        primary_text: newPrimary,
        description: newDescription,
        cta: newCta,
      },
    },
    summary: `${row.channel}: ${newHeadline}`,
    mutated: true,
  };
}

async function execGenerateVisual(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  const input = GenerateVisualInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    channel: string;
    headline: string;
    primary_text: string;
    product_title: string;
    product_image_url: string | null;
    meta: unknown;
  }>(
    `SELECT v.id, v.channel, v.headline, v.primary_text, v.meta,
            p.enriched_title AS product_title, p.image_url AS product_image_url
       FROM dropship_ad_variants v
       JOIN dropship_store_products p ON p.id = v.product_id
       WHERE v.id = $1 AND v.store_id = $2 LIMIT 1`,
    [input.variant_id, store.id],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Variante ${input.variant_id} introuvable dans ce store.`);
  }
  if (!isR2Configured()) {
    throw new Error('R2 non configuré — impossible d’héberger le visuel généré.');
  }

  const prompt = input.prompt ?? buildVisualPrompt(row.headline, row.product_title, store.niche);

  const bytes = await falGenerateImage({
    prompt,
    referenceImageUrl: row.product_image_url ?? undefined,
  });

  const key = `${store.slug}/ads/${row.id}-${Date.now()}.png`;
  const url = await uploadToR2({ key, body: bytes, contentType: 'image/png' });

  // Persist into the JSONB `meta` column so we don't fork the schema.
  const meta = isPlainObject(row.meta) ? { ...row.meta } : {};
  meta.image_url = url;
  meta.image_prompt = prompt;
  meta.image_generated_at = new Date().toISOString();

  await db.query(`UPDATE dropship_ad_variants SET meta = $1 WHERE id = $2`, [JSON.stringify(meta), row.id]);

  return {
    output: { variant_id: row.id, image_url: url, prompt },
    summary: `Visuel généré pour ${row.channel} (${row.headline.slice(0, 40)})`,
    mutated: true,
  };
}

async function execSuggestTargeting(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  const input = SuggestTargetingInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    enriched_title: string;
    enriched_description: string;
  }>(
    `SELECT id, enriched_title, enriched_description
       FROM dropship_store_products WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [input.product_id, store.id],
  );
  const product = rows[0];
  if (!product) {
    throw new Error(`Produit ${input.product_id} introuvable.`);
  }

  const response = await trackedMessage({ step: 'ads-suggest-targeting' }, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Produit: ${product.enriched_title}
Description: ${product.enriched_description.slice(0, 600)}
Niche: ${store.niche}
Canal: ${input.channel}

Propose un ciblage publicitaire. Retourne UNIQUEMENT ce JSON:
{
  "age_min": 18,
  "age_max": 55,
  "genders": [],
  "interests": ["...", "..."],
  "locations": ["FR"],
  "placements": ["..."],
  "recommended_daily_budget_eur": 25
}

Règles:
- "genders": [] si neutre, [1] hommes, [2] femmes (codes Meta).
- "interests": 3 à 8 mots-clés courts, en français.
- "placements" par canal:
   * meta: ["feed","stories","reels"] possibles
   * tiktok: ["tiktok","topbuzz"] possibles
   * google: ["search","demand_gen","performance_max"] possibles
- "recommended_daily_budget_eur": entier entre 5 et 200.`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<{
    age_min?: number;
    age_max?: number;
    genders?: number[];
    interests?: string[];
    locations?: string[];
    placements?: string[];
    recommended_daily_budget_eur?: number;
  }>(text);
  if (!parsed) {
    throw new Error('Le modèle n’a pas renvoyé un JSON exploitable.');
  }
  const targeting = {
    age_min: parsed.age_min ?? 18,
    age_max: parsed.age_max ?? 65,
    genders: Array.isArray(parsed.genders) ? parsed.genders : [],
    interests: Array.isArray(parsed.interests) ? parsed.interests.slice(0, 10) : [],
    locations: Array.isArray(parsed.locations) && parsed.locations.length ? parsed.locations : ['FR'],
    placements: Array.isArray(parsed.placements) ? parsed.placements : [],
    recommended_daily_budget_eur: parsed.recommended_daily_budget_eur ?? 25,
  };

  // Persist on every matching variant so the push route reads it.
  await db.query(
    `UPDATE dropship_ad_variants
        SET targeting_json = $1
        WHERE product_id = $2 AND store_id = $3 AND channel = $4`,
    [JSON.stringify(targeting), input.product_id, store.id, input.channel],
  );

  return {
    output: { product_id: input.product_id, channel: input.channel, targeting },
    summary: `Ciblage ${input.channel} suggéré (${targeting.recommended_daily_budget_eur} €/j)`,
    mutated: true,
  };
}

const CPM_BY_CHANNEL: Record<'meta' | 'tiktok' | 'google', number> = {
  meta: 8,
  tiktok: 6,
  google: 12,
};

const CONVERSION_RATE: Record<'meta' | 'tiktok' | 'google', { ctr: number; cvr: number }> = {
  meta: { ctr: 0.012, cvr: 0.018 },
  tiktok: { ctr: 0.016, cvr: 0.014 },
  google: { ctr: 0.04, cvr: 0.03 },
};

async function execEstimateBudget(store: StoreContext, raw: unknown): Promise<ToolExecutionResult> {
  const input = EstimateBudgetInput.parse(raw);
  const channels: Array<'meta' | 'tiktok' | 'google'> = input.channel
    ? [input.channel]
    : ['meta', 'tiktok', 'google'];

  const breakdown = channels.map((c) => {
    const cpm = CPM_BY_CHANNEL[c];
    const total = input.daily_budget_eur * input.days;
    const impressions = (total / cpm) * 1000;
    const impressionsMin = Math.round(impressions * 0.7);
    const impressionsMax = Math.round(impressions * 1.3);
    const { ctr, cvr } = CONVERSION_RATE[c];
    const expectedClicks = Math.round(impressions * ctr);
    const expectedPurchases = Math.round(expectedClicks * cvr);
    return {
      channel: c,
      cpm_eur: cpm,
      spend_eur: total,
      impressions_min: impressionsMin,
      impressions_max: impressionsMax,
      expected_clicks: expectedClicks,
      expected_purchases: expectedPurchases,
    };
  });

  return {
    output: {
      product_id: input.product_id,
      daily_budget_eur: input.daily_budget_eur,
      days: input.days,
      breakdown,
    },
    summary: `Estimation pour ${input.daily_budget_eur} €/j × ${input.days}j (${channels.join(', ')})`,
  };
  void store;
}

function buildVisualPrompt(headline: string, productTitle: string, niche: string): string {
  return `Square 1:1 ad creative for "${productTitle}" (${niche}). Bold hook overlay: "${headline}". Premium e-commerce product photography aesthetic, soft natural light, minimal background. No people unless necessary. High contrast, scroll-stopping.`;
}

function extractImageUrl(meta: unknown): string | null {
  if (!isPlainObject(meta)) return null;
  const v = meta.image_url;
  return typeof v === 'string' ? v : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

type ToolName =
  | 'list_variants'
  | 'list_products'
  | 'rewrite_hook'
  | 'generate_visual'
  | 'suggest_targeting'
  | 'estimate_budget';

async function executeTool(
  name: string,
  input: unknown,
  store: StoreContext,
): Promise<ToolExecutionResult> {
  switch (name as ToolName) {
    case 'list_variants':
      return execListVariants(store, input);
    case 'list_products':
      return execListProducts(store, input);
    case 'rewrite_hook':
      return execRewriteHook(store, input);
    case 'generate_visual':
      return execGenerateVisual(store, input);
    case 'suggest_targeting':
      return execSuggestTargeting(store, input);
    case 'estimate_budget':
      return execEstimateBudget(store, input);
    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}


export const __internals = {
  TOOLS,
  rebuildMessages,
  buildSystemPrompt,
  executeTool,
  loadStore,
  loadHistory,
  insertMessage,
  ADS_MODEL,
};
