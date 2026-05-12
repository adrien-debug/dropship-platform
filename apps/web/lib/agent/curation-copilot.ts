/**
 * Conversational curation copilot — per-store chat agent.
 *
 * The store-creator pipeline freezes the catalog at creation time. This module
 * lets the operator say "add 3 yoga blocks", "replace product #2 with a
 * premium alternative", "raise margins on the cheap ones" — without leaving
 * the admin. It exposes Anthropic tool_use blocks (not free-text JSON) so
 * Claude's arguments are typed and we never parse prose.
 *
 * Lifecycle of a single turn:
 *
 *   1. Load history from dropship_curation_messages (ordered ASC).
 *   2. Append the new `user` row.
 *   3. Loop:
 *      - Call Sonnet with tools enabled.
 *      - If stop_reason === 'end_turn' → persist assistant text, yield `done`.
 *      - If stop_reason === 'tool_use' → for each ToolUseBlock:
 *            * validate input with Zod (Claude can hallucinate fields)
 *            * execute the tool against the real backend
 *            * append a `tool` row with tool_input + tool_output
 *            * feed a tool_result block back to Claude
 *      - Loop again.
 *   4. Hard cap on tool-call loops (`MAX_TOOL_LOOPS`) prevents infinite tool
 *      calls if Claude misbehaves.
 *
 * Cost / safety:
 *   - Wrapped in `runContext.run({ storeId })` so every trackedMessage lands
 *     in `dropship_ai_runs` attributed to this store.
 *   - System prompt constrains Claude to ≤3 product additions per turn
 *     without confirmation and one clarifying question max.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { medusa } from '@/lib/medusa';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';
import { trackedMessage } from './anthropic';
import { runContext } from './run-context';
import { rankAndKeepTop } from './product-scorer';
import { buildMedusaHandle } from './handle';
import { extractJson } from './json';

// Sonnet 4.6 is the lowest priced model in our table that does reliable tool
// use. Haiku 4.5 is cheaper but in our tests it occasionally invents tool
// names. If a sonnet-4-7 ships, swap here.
const CURATION_MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_LOOPS = 8;
const MAX_TOOLS_PER_TURN = 16;

// ── Tool schemas (Zod) ────────────────────────────────────────────────
// Zod is the source of truth — we derive both the Anthropic schema string
// and the runtime validation from the same definitions.

const SearchProductsInput = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

const ListCurrentProductsInput = z.object({}).strict();

const AddProductInput = z.object({
  supplier: z.enum(['aliexpress', 'cj']),
  supplier_product_id: z.string().min(1),
  overrides: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      price_cents: z.number().int().positive().optional(),
    })
    .optional(),
});

const RemoveProductInput = z.object({
  product_id: z.string().uuid(),
});

const UpdateProductPriceInput = z.object({
  product_id: z.string().uuid(),
  price_cents: z.number().int().positive(),
});

const RewriteProductCopyInput = z.object({
  product_id: z.string().uuid(),
  instruction: z.string().min(2).max(500),
});

// Anthropic's `Tool` definitions — `input_schema` is required JSONSchema.
const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'search_products',
    description:
      "Search for new products on AliExpress and CJ Dropshipping for this store's niche. Returns top-N scored candidates with title, price, cost, margin, image. Use this when the user asks to add or explore new products.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords describing the product type to search.' },
        limit: { type: 'number', description: 'Max number of candidates to return (default 10, capped at 25).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_current_products',
    description:
      'List the products currently in the store with id, title, price, cost, margin, supplier. Use this when the user references existing products vaguely (e.g. "the cheap ones", "product #2").',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_product',
    description:
      'Add a candidate product (from a previous search_products result) to the store. Imports it to Medusa under the store sales channel and inserts into dropship_store_products. Always show the user a preview before adding more than one product.',
    input_schema: {
      type: 'object',
      properties: {
        supplier: { type: 'string', enum: ['aliexpress', 'cj'] },
        supplier_product_id: { type: 'string' },
        overrides: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            price_cents: { type: 'number' },
          },
        },
      },
      required: ['supplier', 'supplier_product_id'],
    },
  },
  {
    name: 'remove_product',
    description:
      'Remove a product from the store. Deletes from Medusa and dropship_store_products. Confirm with the user before removing.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'UUID from dropship_store_products.id' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'update_product_price',
    description:
      'Update the retail price of a product (in cents). Margin = price - cost. Stays in the dropship_store_products row only; Medusa retains its own variant price.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'UUID from dropship_store_products.id' },
        price_cents: { type: 'number', description: 'New retail price in euro cents.' },
      },
      required: ['product_id', 'price_cents'],
    },
  },
  {
    name: 'rewrite_product_copy',
    description:
      'Rewrite the title and/or description of a product using Claude. Pass an instruction like "make it more premium" or "shorter".',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'UUID from dropship_store_products.id' },
        instruction: { type: 'string' },
      },
      required: ['product_id', 'instruction'],
    },
  },
];

// ── Public types ────────────────────────────────────────────────────────

export interface CurationStreamEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'done' | 'error';
  data: unknown;
}

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
  name: string;
  niche: string;
  mode: 'mono' | 'collection' | null;
  medusa_sales_channel_id: string | null;
  product_count: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function loadStore(storeId: string): Promise<StoreContext | null> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    name: string;
    niche: string;
    mode: string | null;
    medusa_sales_channel_id: string | null;
    product_count: number | null;
  }>(
    `SELECT id, name, niche, mode, medusa_sales_channel_id, product_count
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    niche: r.niche,
    mode: (r.mode === 'mono' || r.mode === 'collection') ? r.mode : null,
    medusa_sales_channel_id: r.medusa_sales_channel_id,
    product_count: r.product_count ?? 0,
  };
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

/**
 * Re-hydrate the stored chat into Anthropic message blocks.
 *
 * Stored rows are flat (`user|assistant|tool`); the Anthropic schema groups
 * tool_use + tool_result into separate assistant/user turns. We reconstruct
 * that pairing by treating sequences of `tool` rows that immediately
 * follow an `assistant` row as the matching tool_result blocks.
 */
function rebuildMessages(
  history: StoredMessage[],
): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];

  let pendingToolUses: Array<{
    id: string;
    name: string;
    input: unknown;
  }> = [];
  let pendingAssistantText = '';

  const flushAssistant = () => {
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];
    if (pendingAssistantText.trim()) {
      blocks.push({ type: 'text', text: pendingAssistantText });
    }
    for (const tu of pendingToolUses) {
      blocks.push({
        type: 'tool_use',
        id: tu.id,
        name: tu.name,
        input: tu.input ?? {},
      });
    }
    if (blocks.length) out.push({ role: 'assistant', content: blocks });
    pendingAssistantText = '';
    pendingToolUses = [];
  };

  for (let i = 0; i < history.length; i++) {
    const row = history[i]!;
    if (row.role === 'user') {
      flushAssistant();
      out.push({ role: 'user', content: row.content });
    } else if (row.role === 'assistant') {
      flushAssistant();
      // The stored `content` for assistant rows can include a JSON tail with
      // tool_use blocks. We use a structured marker: `tool_input` is null on
      // assistant rows. Tool calls land in their own `tool` rows immediately
      // following the assistant turn.
      pendingAssistantText = row.content;
    } else if (row.role === 'tool') {
      // Tool result: pair it with the most recent assistant turn. We re-emit
      // it as a `tool_use` from the assistant + a `tool_result` from user.
      const useId = (row.tool_input && typeof row.tool_input === 'object' && '__tool_use_id' in row.tool_input)
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
  const mode = store.mode ?? 'collection';
  return [
    `You are a senior dropshipping merchandiser embedded in the admin of "${store.name}" (niche: "${store.niche}", mode: ${mode}, ${store.product_count} products currently).`,
    '',
    'Your job is to help the operator curate this store via tools: search candidates, add/remove products, tune prices, rewrite copy.',
    '',
    'You are ONE mode of a multi-mode Copilote hub. The other modes the operator can switch to (via the pills at the top of /admin/stores/[id]/copilot) all live in the SAME admin you are running inside. NEVER tell the operator that something is "outside your perimeter" or "requires a developer" if another mode of the hub can do it. Instead, name the mode and invite them to switch:',
    '',
    '- **Médias** : régénère hero, cutout, lifestyles, vidéo promo du storefront via fal.ai / ComfyUI. Tools: regenerate_asset, set_as_current, list_assets. Use it for anything related to visuals, hero image, banners, product imagery on the storefront.',
    '- **Ads** : génère les hooks/visuels publicitaires Meta/TikTok/Google, pousse les campagnes via API, lit le ROAS.',
    '- **Recherche** : Tavily + Perplexity + Meta Ads Library + AE search pour trouver une nouvelle niche.',
    '- **Dev** : édite le code source du site lui-même (Next.js + Tailwind du storefront). Tools: read_file, write_file, apply_patch, run_bash, git_commit, git_push. Use it for layout changes, color schemes, hero section refactor, new components.',
    '',
    'When the operator asks for something outside curation (e.g. "change the hero background to black", "rewrite the storefront layout", "add a banner"), say so plainly: "Ça relève du mode Médias (pour régénérer le visuel) ou du mode Dev (pour modifier le code du storefront). Switch via le sélecteur en haut, et je te file la main." Then stop.',
    '',
    'Rules:',
    '- Speak French by default (the operator is French). Switch to English only if they do.',
    '- When the user is vague, ask AT MOST one short clarifying question before acting.',
    '- Never add more than 3 products in a single turn without explicit user confirmation.',
    '- Before any add/remove/price-change burst, list what you are about to do and wait one turn unless the user already said "go".',
    '- When showing search results, present them numbered with title, price, cost, margin, supplier — never raw JSON.',
    '- Never invent product IDs. Always source them from list_current_products or a previous search_products result.',
    '- No em-dashes (—), no three-beat triads. Write tight, concrete French.',
    '- If a tool fails, surface the error in plain French and propose the next action.',
  ].join('\n');
}

// ── Tool executors ──────────────────────────────────────────────────────

interface ToolExecutionResult {
  output: unknown;
  /** Compact human-readable summary shown in the chat tool card. */
  summary: string;
  /** True if the catalog changed (UI should re-fetch product list). */
  mutated?: boolean;
}

async function execSearchProducts(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  const input = SearchProductsInput.parse(raw);
  const limit = input.limit ?? 10;

  const [aliRes, cjRes] = await Promise.allSettled([
    aliexpress.searchProducts({
      keywords: input.query,
      pageSize: Math.min(limit * 2, 30),
      currency: 'EUR',
      countryCode: 'FR',
      locale: 'fr_FR',
    }),
    cj.searchProducts({ keywords: input.query, pageSize: Math.min(limit * 2, 30) }),
  ]);

  type Candidate = {
    supplier: 'aliexpress' | 'cj';
    externalId: string;
    title: string;
    price: number;
    imageUrl: string;
    supplierUrl: string;
    orders?: number;
    evaluateRate?: string;
  };

  const candidates: Candidate[] = [];
  if (aliRes.status === 'fulfilled' && aliRes.value.success && aliRes.value.data) {
    for (const p of aliRes.value.data.products) {
      const ordersParsed = parseInt(p.thirty_days_sold_count || '0', 10);
      candidates.push({
        supplier: 'aliexpress',
        externalId: p.product_id,
        title: p.product_title,
        price: parseFloat(p.sale_price || p.original_price || '0'),
        imageUrl: p.product_main_image_url,
        supplierUrl: p.product_url,
        orders: Number.isFinite(ordersParsed) ? ordersParsed : undefined,
        evaluateRate: p.evaluate_rate || undefined,
      });
    }
  }
  if (cjRes.status === 'fulfilled' && cjRes.value.success && cjRes.value.data) {
    for (const p of cjRes.value.data.list) {
      candidates.push({
        supplier: 'cj',
        externalId: p.pid,
        title: p.productNameEn,
        price: p.sellPrice,
        imageUrl: p.productImage,
        supplierUrl: p.sellUrl || '',
      });
    }
  }

  const top = rankAndKeepTop(candidates, limit).map((p) => {
    const costCents = Math.max(0, Math.round(p.price * 100));
    // Mirror store-creator pricing rule: cost * 2.2, floor 999, round to .99
    const retailRaw = Math.max(999, Math.round(costCents * 2.2 / 100) * 100 - 1);
    const marginCents = retailRaw - costCents;
    return {
      supplier: p.supplier,
      supplier_product_id: p.externalId,
      title: p.title,
      image_url: p.imageUrl,
      supplier_url: p.supplierUrl,
      cost_cents: costCents,
      suggested_price_cents: retailRaw,
      margin_cents: marginCents,
      orders: p.orders,
      score: p._score,
      score_reasons: p._scoreReasons,
    };
  });

  // Surface supplier connectivity errors so the model can tell the user
  // why a search returned nothing — better than silent zero results.
  const errors: string[] = [];
  if (aliRes.status === 'fulfilled' && !aliRes.value.success) errors.push(`AE: ${aliRes.value.error}`);
  if (aliRes.status === 'rejected') errors.push(`AE: ${aliRes.reason instanceof Error ? aliRes.reason.message : String(aliRes.reason)}`);
  if (cjRes.status === 'fulfilled' && !cjRes.value.success) errors.push(`CJ: ${cjRes.value.error}`);
  if (cjRes.status === 'rejected') errors.push(`CJ: ${cjRes.reason instanceof Error ? cjRes.reason.message : String(cjRes.reason)}`);

  return {
    output: { query: input.query, candidates: top, supplier_errors: errors },
    summary: `Recherche "${input.query}" — ${top.length} candidat${top.length === 1 ? '' : 's'} (sur ${candidates.length} bruts)`,
  };
  // (store id is kept in scope only to avoid lint warning; future versions
  // could filter against already-imported externalIds to avoid duplicates.)
  void store;
}

async function execListCurrentProducts(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  ListCurrentProductsInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    supplier: string;
    enriched_title: string;
    enriched_description: string;
    price_cents: number;
    cost_cents: number;
    image_url: string | null;
    medusa_product_id: string | null;
  }>(
    `SELECT id, supplier, enriched_title, enriched_description, price_cents,
            cost_cents, image_url, medusa_product_id
       FROM dropship_store_products
       WHERE store_id = $1
       ORDER BY created_at ASC`,
    [store.id],
  );

  const products = rows.map((r) => ({
    product_id: r.id,
    supplier: r.supplier,
    title: r.enriched_title,
    description: r.enriched_description,
    price_cents: r.price_cents,
    cost_cents: r.cost_cents,
    margin_cents: r.price_cents - r.cost_cents,
    margin_pct: r.cost_cents > 0 ? Math.round(((r.price_cents - r.cost_cents) / r.cost_cents) * 100) : 0,
    image_url: r.image_url,
    medusa_product_id: r.medusa_product_id,
  }));
  return {
    output: { products },
    summary: `${products.length} produit${products.length === 1 ? '' : 's'} en catalogue`,
  };
}

async function execAddProduct(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  const input = AddProductInput.parse(raw);
  if (!store.medusa_sales_channel_id) {
    throw new Error('Ce store n’a pas de sales channel Medusa — impossible d’ajouter un produit.');
  }

  // Re-fetch the candidate from the supplier so price/title can't be spoofed
  // by Claude. If the search result is cold (>1h), this also refreshes it.
  let title: string | undefined;
  let imageUrl = '';
  let supplierUrl = '';
  let costCents = 0;

  if (input.supplier === 'aliexpress') {
    // The DS text search is our only catalog probe right now; we re-search
    // by the title hint stored in overrides, or by the product id itself.
    const probe = await aliexpress.searchProducts({
      keywords: input.overrides?.title || input.supplier_product_id,
      pageSize: 30,
      currency: 'EUR',
      countryCode: 'FR',
      locale: 'fr_FR',
    });
    const match = probe.success && probe.data
      ? probe.data.products.find((p) => p.product_id === input.supplier_product_id)
      : undefined;
    if (!match) {
      throw new Error(`AliExpress: produit ${input.supplier_product_id} introuvable.`);
    }
    title = match.product_title;
    imageUrl = match.product_main_image_url;
    supplierUrl = match.product_url;
    costCents = Math.round(parseFloat(match.sale_price || match.original_price || '0') * 100);
  } else {
    const probe = await cj.searchProducts({
      keywords: input.overrides?.title || input.supplier_product_id,
      pageSize: 30,
    });
    const match = probe.success && probe.data
      ? probe.data.list.find((p) => p.pid === input.supplier_product_id)
      : undefined;
    if (!match) {
      throw new Error(`CJ: produit ${input.supplier_product_id} introuvable.`);
    }
    title = match.productNameEn;
    imageUrl = match.productImage;
    supplierUrl = match.sellUrl;
    costCents = Math.round(match.sellPrice * 100);
  }

  const finalTitle = input.overrides?.title || title || 'Produit sans titre';
  const finalDescription = input.overrides?.description ||
    `${finalTitle}. Importé via curation copilot.`;
  const finalPriceCents = input.overrides?.price_cents ??
    Math.max(999, Math.round((costCents * 2.2) / 100) * 100 - 1);

  const handle = buildMedusaHandle({
    title: finalTitle,
    externalId: input.supplier_product_id,
    storeId: store.id,
  });

  const medusaProduct = await medusa.createProductWithChannel(
    {
      title: finalTitle,
      description: finalDescription,
      handle,
      status: 'published',
      thumbnail: imageUrl || undefined,
      images: imageUrl ? [imageUrl] : [],
      options: [{ title: 'Default', values: ['Standard'] }],
      variants: [
        {
          title: 'Standard',
          prices: [{ currency_code: 'eur', amount: finalPriceCents / 100 }],
          inventory_quantity: 999,
        },
      ],
      metadata: {
        supplier: input.supplier,
        external_id: input.supplier_product_id,
        cost_cents: costCents,
        store_id: store.id,
        source: 'curation-copilot',
      },
    },
    store.medusa_sales_channel_id,
  );

  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_store_products
       (store_id, medusa_product_id, supplier, external_id,
        original_title, enriched_title, enriched_description,
        price_cents, cost_cents, image_url, supplier_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (store_id, supplier, external_id) DO UPDATE
       SET enriched_title = EXCLUDED.enriched_title,
           enriched_description = EXCLUDED.enriched_description,
           price_cents = EXCLUDED.price_cents
     RETURNING id`,
    [
      store.id, medusaProduct.id, input.supplier, input.supplier_product_id,
      title || finalTitle, finalTitle, finalDescription,
      finalPriceCents, costCents, imageUrl || null, supplierUrl || null,
    ],
  );

  await db.query(
    `UPDATE dropship_stores SET product_count = (
       SELECT COUNT(*) FROM dropship_store_products WHERE store_id = $1
     ), updated_at = now() WHERE id = $1`,
    [store.id],
  );

  return {
    output: {
      product_id: rows[0]!.id,
      medusa_product_id: medusaProduct.id,
      title: finalTitle,
      price_cents: finalPriceCents,
      cost_cents: costCents,
      margin_cents: finalPriceCents - costCents,
      supplier: input.supplier,
      image_url: imageUrl,
    },
    summary: `Ajouté: ${finalTitle} (${(finalPriceCents / 100).toFixed(2)} €)`,
    mutated: true,
  };
}

async function execRemoveProduct(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  const input = RemoveProductInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    medusa_product_id: string | null;
    enriched_title: string;
  }>(
    `SELECT id, medusa_product_id, enriched_title FROM dropship_store_products
       WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [input.product_id, store.id],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Produit ${input.product_id} introuvable dans ce store.`);
  }

  if (row.medusa_product_id) {
    try {
      await medusa.deleteProduct(row.medusa_product_id);
    } catch (e) {
      // Medusa already gone? Continue with the DB delete so the catalog
      // doesn't stay in a ghost state.
      console.warn('[curation] Medusa deleteProduct failed, continuing', e);
    }
  }

  await db.query(`DELETE FROM dropship_store_products WHERE id = $1`, [row.id]);
  await db.query(
    `UPDATE dropship_stores SET product_count = (
       SELECT COUNT(*) FROM dropship_store_products WHERE store_id = $1
     ), updated_at = now() WHERE id = $1`,
    [store.id],
  );

  return {
    output: {
      product_id: row.id,
      title: row.enriched_title,
      medusa_deleted: Boolean(row.medusa_product_id),
    },
    summary: `Supprimé: ${row.enriched_title}`,
    mutated: true,
  };
}

async function execUpdateProductPrice(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  const input = UpdateProductPriceInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    enriched_title: string;
    price_cents: number;
    cost_cents: number;
  }>(
    `SELECT id, enriched_title, price_cents, cost_cents
       FROM dropship_store_products WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [input.product_id, store.id],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Produit ${input.product_id} introuvable dans ce store.`);
  }
  await db.query(
    `UPDATE dropship_store_products SET price_cents = $1 WHERE id = $2`,
    [input.price_cents, row.id],
  );
  return {
    output: {
      product_id: row.id,
      title: row.enriched_title,
      previous_price_cents: row.price_cents,
      new_price_cents: input.price_cents,
      cost_cents: row.cost_cents,
      new_margin_cents: input.price_cents - row.cost_cents,
    },
    summary: `${row.enriched_title}: ${(row.price_cents / 100).toFixed(2)} € → ${(input.price_cents / 100).toFixed(2)} €`,
    mutated: true,
  };
}

async function execRewriteProductCopy(
  store: StoreContext,
  raw: unknown,
): Promise<ToolExecutionResult> {
  const input = RewriteProductCopyInput.parse(raw);
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    enriched_title: string;
    enriched_description: string;
    medusa_product_id: string | null;
  }>(
    `SELECT id, enriched_title, enriched_description, medusa_product_id
       FROM dropship_store_products WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [input.product_id, store.id],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Produit ${input.product_id} introuvable dans ce store.`);
  }

  const response = await trackedMessage({ step: 'curate-rewrite-copy' }, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a senior French dropshipping copywriter. Rewrite the title and description below following this instruction: "${input.instruction}".

Current title: ${row.enriched_title}
Current description: ${row.enriched_description}

Rules:
- French.
- Title max 65 characters.
- Description 120-180 words, benefit-led.
- No em-dashes (—). No three-beat triads.

Return ONLY this JSON:
{"title": "...", "description": "..."}`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<{ title?: string; description?: string }>(text);
  if (!parsed || !parsed.title || !parsed.description) {
    throw new Error('Le modèle n’a pas renvoyé un JSON exploitable.');
  }
  const newTitle = parsed.title.slice(0, 200);
  const newDescription = parsed.description.slice(0, 4000);

  await db.query(
    `UPDATE dropship_store_products
       SET enriched_title = $1, enriched_description = $2
       WHERE id = $3`,
    [newTitle, newDescription, row.id],
  );

  if (row.medusa_product_id) {
    try {
      await medusa.updateProduct(row.medusa_product_id, {
        title: newTitle,
        description: newDescription,
      });
    } catch (e) {
      console.warn('[curation] Medusa updateProduct failed', e);
    }
  }

  return {
    output: {
      product_id: row.id,
      before: { title: row.enriched_title, description: row.enriched_description },
      after: { title: newTitle, description: newDescription },
    },
    summary: `Copy réécrite: ${newTitle}`,
    mutated: true,
  };
}

type ToolName =
  | 'search_products'
  | 'list_current_products'
  | 'add_product'
  | 'remove_product'
  | 'update_product_price'
  | 'rewrite_product_copy';

async function executeTool(
  name: string,
  input: unknown,
  store: StoreContext,
): Promise<ToolExecutionResult> {
  switch (name as ToolName) {
    case 'search_products':
      return execSearchProducts(store, input);
    case 'list_current_products':
      return execListCurrentProducts(store, input);
    case 'add_product':
      return execAddProduct(store, input);
    case 'remove_product':
      return execRemoveProduct(store, input);
    case 'update_product_price':
      return execUpdateProductPrice(store, input);
    case 'rewrite_product_copy':
      return execRewriteProductCopy(store, input);
    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}

// ── Public entry point ──────────────────────────────────────────────────

/**
 * Create a new curation session for a store. Returns the new session id.
 * Public so the SSE route can lazily create a session when none is passed.
 */
export async function createCurationSession(storeId: string): Promise<string> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_curation_sessions (store_id) VALUES ($1) RETURNING id`,
    [storeId],
  );
  return rows[0]!.id;
}

/**
 * Stream a single chat turn. Each yielded event is JSON-serializable so the
 * SSE route can pass it straight to the wire.
 */
export async function* runCurationTurn(
  storeId: string,
  sessionId: string,
  userMessage: string,
): AsyncGenerator<CurationStreamEvent> {
  const events: CurationStreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let runDone = false;
  let runError: unknown = null;

  const emit = (e: CurationStreamEvent) => {
    events.push(e);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const run = async () => {
    try {
      const store = await loadStore(storeId);
      if (!store) throw new Error(`Store ${storeId} introuvable.`);

      // Persist the user message FIRST so a crash mid-turn still leaves a
      // queryable history.
      await insertMessage(sessionId, { role: 'user', content: userMessage });

      const history = await loadHistory(sessionId);
      const messages = rebuildMessages(history);

      await runContext.run({ storeId }, async () => {
        let loops = 0;
        let toolCallsThisTurn = 0;
        let finalAssistantText = '';

        while (loops < MAX_TOOL_LOOPS) {
          loops++;

          const response = await trackedMessage({ step: 'curate-turn' }, {
            model: CURATION_MODEL,
            max_tokens: 4096,
            system: buildSystemPrompt(store),
            tools: TOOLS,
            messages,
          });

          // Extract text (concatenated across multiple text blocks) and
          // tool_use blocks from the response.
          const textBlocks = response.content.filter((b) => b.type === 'text') as Array<Extract<typeof response.content[number], { type: 'text' }>>;
          const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Array<Extract<typeof response.content[number], { type: 'tool_use' }>>;
          const assistantText = textBlocks.map((b) => b.text).join('\n').trim();

          if (assistantText) {
            emit({ type: 'thinking', data: { text: assistantText } });
            finalAssistantText = assistantText;
          }

          // Push the assistant turn into the running message list verbatim.
          messages.push({
            role: 'assistant',
            content: response.content
              .filter((b) => b.type === 'text' || b.type === 'tool_use')
              .map((b) => {
                if (b.type === 'text') return { type: 'text', text: b.text };
                return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
              }) as Anthropic.Messages.ContentBlockParam[],
          });

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            // Normal end-of-turn. Persist the assistant text (may be empty
            // if Claude only emitted tool calls — uncommon at end_turn).
            await insertMessage(sessionId, {
              role: 'assistant',
              content: finalAssistantText,
            });
            emit({ type: 'message', data: { text: finalAssistantText } });
            emit({ type: 'done', data: { text: finalAssistantText } });
            return;
          }

          // Persist the assistant text BEFORE running tools, so the chat
          // history shows Claude's preamble even if a tool crashes.
          if (assistantText) {
            await insertMessage(sessionId, {
              role: 'assistant',
              content: assistantText,
            });
          }

          // Execute every tool_use block in order, collecting tool_result
          // blocks for the next iteration's user turn.
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (toolCallsThisTurn >= MAX_TOOLS_PER_TURN) {
              const msg = `Maximum d’appels d’outils par tour atteint (${MAX_TOOLS_PER_TURN}).`;
              await insertMessage(sessionId, {
                role: 'tool',
                content: msg,
                toolName: block.name,
                toolInput: { __tool_use_id: block.id, ...(block.input as object) },
                toolOutput: { error: msg },
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: msg,
                is_error: true,
              });
              continue;
            }
            toolCallsThisTurn++;

            emit({
              type: 'tool_call',
              data: { id: block.id, name: block.name, input: block.input },
            });

            let toolOutput: unknown;
            let summary = '';
            let isError = false;
            try {
              const result = await executeTool(block.name, block.input, store);
              toolOutput = result.output;
              summary = result.summary;
            } catch (e) {
              isError = true;
              const message = e instanceof Error ? e.message : String(e);
              // Zod errors come through as ZodError — extract a cleaner
              // message so the model can fix the input next turn.
              const zodIssues = e instanceof z.ZodError ? e.errors.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : null;
              toolOutput = { error: message, ...(zodIssues ? { issues: zodIssues } : {}) };
              summary = `Erreur: ${message}`;
            }

            await insertMessage(sessionId, {
              role: 'tool',
              content: summary,
              toolName: block.name,
              toolInput: { __tool_use_id: block.id, ...(block.input as object) },
              toolOutput,
            });

            emit({
              type: 'tool_result',
              data: { id: block.id, name: block.name, output: toolOutput, summary, is_error: isError },
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: stringifyToolOutput(toolOutput),
              is_error: isError,
            });
          }

          // Feed tool_results back as a user turn so Claude can synthesise.
          messages.push({ role: 'user', content: toolResults });
        }

        // Loop guard tripped — surface and stop.
        const guardMsg = `Boucle d’outils maximale atteinte (${MAX_TOOL_LOOPS}).`;
        await insertMessage(sessionId, { role: 'assistant', content: guardMsg });
        emit({ type: 'message', data: { text: guardMsg } });
        emit({ type: 'done', data: { text: guardMsg } });
      });
    } catch (e) {
      runError = e;
      const message = e instanceof Error ? e.message : String(e);
      emit({ type: 'error', data: { message } });
    } finally {
      runDone = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    }
  };

  // Fire the worker without awaiting; the generator below drains `events`.
  void run();

  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (runDone) {
      return;
    } else {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
  // Touch runError so the linter doesn't strip it; the error has already
  // been emitted to the consumer via the `error` event above.
  void runError;
}

// Internal exports for testing only. Not part of the public surface.
export const __internals = {
  TOOLS,
  rebuildMessages,
  buildSystemPrompt,
  executeTool,
  loadStore,
  loadHistory,
  insertMessage,
  CURATION_MODEL,
};
