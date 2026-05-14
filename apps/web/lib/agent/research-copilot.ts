/**
 * Pre-creation niche research copilot.
 *
 * Mirrors the architectural pattern of `curation-copilot.ts` but the tools
 * are oriented around discovery rather than mutation:
 *   - web_search       (Tavily)            : raw web results
 *   - ask_perplexity   (Perplexity Sonar)  : synthesised answers + citations
 *   - meta_ads_library (validateNiche)     : saturation + creatives + angles
 *   - aliexpress_search                    : supplier candidates
 *   - cj_search                            : EU-warehouse alternatives
 *   - shortlist_niche                      : final structured recommendation
 *
 * Conversations live in `dropship_copilot_sessions` / `_messages`. They are
 * NOT tied to a store — the whole point is to converge on a niche BEFORE
 * the operator creates the store.
 *
 * Cost attribution: each Claude call is wrapped in
 *   runContext.run({ storeId: null }, ...)
 * so the `dropship_ai_runs` row lands with a null store_id. The admin
 * cost dashboard already shows null-store rows under "exploratoire".
 *
 * Loop guarantees (same as curation-copilot):
 *   - max 6 Claude turns per user message (MAX_TOOL_LOOPS)
 *   - max 6 tool calls per user message (MAX_TOOLS_PER_TURN — enforced
 *     by the per-turn limit in the system prompt; we still set a hard
 *     numeric cap)
 *   - Zod-validated tool inputs; invalid inputs come back to Claude as a
 *     tool_result with `is_error: true` and a structured issues list, so
 *     it can retry rather than crash the loop.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { trackedMessage } from './anthropic';
import { runContext } from './run-context';
import { validateNiche, type ValidatorCountry } from '@/lib/trends/meta-library';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';
import { tavilySearch, isTavilyConfigured } from '@/lib/research/tavily';
import { perplexityAnswer, isPerplexityConfigured } from '@/lib/research/perplexity';
import { TEMPLATE_IDS, TEMPLATE_CATALOG } from '@/lib/template-catalog';
import { rebuildMessages, stringifyToolOutput } from './copilot-shared';

// Niche research is the most strategic step in the pipeline — the choice of
// niche dictates everything downstream (visuals, copy, ad angles). We run
// the research loop on Opus 4.7 (vs Sonnet on the other modes) so the
// reasoning and the shortlist quality are as strong as we can get them.
// Bounded by MAX_TOOL_LOOPS so a single research session stays under ~$1.
const RESEARCH_MODEL = 'claude-opus-4-7';
const MAX_TOOL_LOOPS = 6;
const MAX_TOOLS_PER_TURN = 8;

// ── Zod schemas for tool inputs ────────────────────────────────────────

const WebSearchInput = z.object({
  query: z.string().min(2).max(300),
  topic: z.enum(['general', 'news']).optional().default('general'),
});

const AskPerplexityInput = z.object({
  query: z.string().min(3).max(500),
});

const MetaAdsLibraryInput = z.object({
  niche: z.string().min(2).max(120),
  country: z.enum(['FR', 'BE', 'CH', 'CA']).optional().default('FR'),
});

const SupplierSearchInput = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(20).optional().default(10),
});

const AdBenchmarksInput = z.object({
  niche: z.string().min(2).max(120),
  country: z.enum(['FR', 'BE', 'CH', 'CA', 'US', 'UK']).optional().default('FR'),
});

const FeaturedProductInput = z.object({
  supplier: z.enum(['aliexpress', 'cj']),
  supplier_product_id: z.string().min(1).max(80),
  title: z.string().min(2).max(300),
  image_url: z.string().url().max(2000),
  supplier_url: z.string().url().max(2000),
  cost_cents: z.number().int().min(0).max(1_000_000),
  suggested_price_cents: z.number().int().min(0).max(1_000_000),
  orders: z.number().int().min(0).optional(),
  rating: z.string().max(20).nullable().optional(),
  why_this_one: z.string().min(0).max(400).optional(),
  /** One sentence justifying the recommended retail price, grounded in
   *  a market benchmark (Amazon FR, DTC competitor). Forces Claude to
   *  prove it actually checked the market instead of using cost × 2.2. */
  pricing_rationale: z.string().min(10).max(400),
  expected_aov_eur: z.number().min(0).max(10_000).optional(),
});

const AdsChannelInput = z.object({
  name: z.enum(['meta', 'tiktok', 'google', 'pinterest']),
  weight_pct: z.number().int().min(0).max(100),
  expected_cpm_eur: z.number().min(0).max(200).optional(),
  expected_cpc_eur: z.number().min(0).max(10).optional(),
  expected_cpa_eur: z.number().min(0).max(200).optional(),
  rationale: z.string().min(0).max(200).optional(),
});

const MediaPlanInput = z.object({
  daily_budget_eur: z.number().min(0).max(5_000),
  channels: z.array(AdsChannelInput).min(1).max(8),
  geo: z.object({
    primary_countries: z.array(z.string()).min(1).max(10),
    emphasis: z.array(z.string()).max(20).optional(),
    rationale: z.string().max(600).optional(),
  }),
  audience: z.object({
    demographics: z.string().min(0).max(600),
    interests: z.array(z.string()).max(30),
    lookalike_seeds: z.array(z.string()).max(15).optional(),
  }),
  schedule: z.object({
    best_hours_local: z.array(z.string()).max(12),
    best_days: z.array(z.string()).max(7),
    timezone: z.string().max(80).optional(),
    rationale: z.string().max(600).optional(),
  }),
  expected_outcomes: z.object({
    daily_orders_low: z.number().min(0).max(100_000),
    daily_orders_high: z.number().min(0).max(100_000),
    target_cpa_eur: z.number().min(0).max(10_000),
    target_roas: z.number().min(0).max(100),
    breakeven_note: z.string().max(600).optional(),
  }),
  top_hooks: z.array(z.string().max(320)).max(10).optional(),
});

// Hex color validator used for the design proposals. Strict so we don't
// accept rgba() or named colors — the storefront injects these as CSS vars
// and we want them to round-trip identically every time.
// The two placeholder values are the legacy app neutrals and look generic on
// any storefront — Claude is explicitly forbidden from using them.
const PLACEHOLDER_COLORS = ['#0f172a', '#6366f1'];
const HexColor = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be #RRGGBB hex')
  .refine(
    (v) => !PLACEHOLDER_COLORS.includes(v.toLowerCase()),
    { message: 'Color is a generic app placeholder — choose a niche-specific color' },
  );

const DesignProposalInput = z.object({
  preset: z.enum([
    'editorial-serif',
    'tech-mono',
    'brutalist-luxe',
    'gen-z-bold',
    'lifestyle-warm',
  ]),
  primary: HexColor,
  accent: HexColor,
  rationale: z.string().min(0).max(400),
});

const ShortlistNicheInput = z.object({
  niche: z.string().min(1).max(80),
  rationale: z.string().min(10).max(800),
  saturation: z.number().min(0).max(100).optional(),
  estimated_aov_eur: z.number().min(0).max(10_000).optional(),
  suggested_store_name: z.string().min(1).max(80),
  target_audience: z.string().min(0).max(400).optional(),
  // The hero product the operator should kick the store off with. The UI
  // renders this image in the shortlist card so the operator can see
  // exactly what they are validating before clicking "Lancer cette niche".
  // Required — a shortlist without a concrete product is not actionable.
  featured_product: FeaturedProductInput,
  // Catalog & layout decisions Claude makes so the operator doesn't have
  // to re-pick after the shortlist. Pre-fills the form below.
  suggested_mode: z.enum(['mono', 'collection']).optional(),
  suggested_template: z
    .enum(TEMPLATE_IDS as unknown as [string, ...string[]])
    .optional(),
  // Full media plan — channel mix, geo, audience, dayparting, outcomes.
  // Required — operator validates this before clicking "Lancer".
  media_plan: MediaPlanInput,
  // Three design candidates the operator picks from in the chat UI. The
  // chosen one is locked in `dropship_stores.design_preset` + `.palette`
  // at creation time and never regenerated. Required — exactly 3.
  design_proposals: z.array(DesignProposalInput).length(3),
});

// ── Anthropic tool surfaces ────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'web_search',
    description:
      'Search the live web (Tavily). Use for: trend research, market sizing, competitor lookup, price benchmarks. Returns the top 5 results with title, url, snippet, optional published date.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query, English or French.' },
        topic: {
          type: 'string',
          enum: ['general', 'news'],
          description: '`news` restricts to recent articles within ~7 days.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'ask_perplexity',
    description:
      "Ask Perplexity (Sonar) for a synthesised answer with citations. Use when you need a quick analytical answer rather than raw search results (e.g. \"What's the AOV range for cat tree DTC brands in 2025?\"). Returns { answer, citations[] }.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'meta_ads_library',
    description:
      'Scrape Meta Ads Library for the niche: returns saturation score 0-100, top advertisers, sample creatives, recurring angles. Cached 24h. Use to assess whether a niche is over/under-served on Meta.',
    input_schema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Niche keyword, 1-4 words.' },
        country: {
          type: 'string',
          enum: ['FR', 'BE', 'CH', 'CA'],
          description: 'Target country code. Default FR.',
        },
      },
      required: ['niche'],
    },
  },
  {
    name: 'aliexpress_search',
    description:
      'Search AliExpress for products in a category. Returns up to 20 candidates with cost (in EUR), orders, rating, image, supplier URL. Use to verify supply exists and assess margin potential (suggested retail = cost * 2.2 rounded to .99).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'Max results (1-20, default 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'cj_search',
    description:
      'Search CJ Dropshipping (EU warehouses, faster shipping than AliExpress). Same shape as aliexpress_search. Returns [] when CJ credentials are missing or the API is down — treat empty results as "supply not verifiable via CJ", not "no supply".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'Max results (1-20, default 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_ad_benchmarks',
    description:
      'Recherche les benchmarks publicitaires réels (CPM, CPC, CPA moyen) pour une niche donnée sur Meta Ads (Facebook/Instagram), TikTok Ads, Google Ads et Pinterest Ads. À appeler OBLIGATOIREMENT avant shortlist_niche pour calibrer le media_plan avec des chiffres sourcés. Retourne les fourchettes de coûts, le canal le plus efficace pour la niche, et les créneaux horaires/jours optimaux si disponibles.',
    input_schema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Niche exacte (ex: "brumisateur nano visage", "veilleuse enfant silicone").' },
        country: { type: 'string', enum: ['FR', 'BE', 'CH', 'CA', 'US', 'UK'], description: 'Marché cible, défaut FR.' },
      },
      required: ['niche'],
    },
  },
  {
    name: 'shortlist_niche',
    description:
      'PRÉCONDITION : Cet outil ne peut être appelé qu\'après que ces 4 outils ont tous retourné des résultats dans la session : meta_ads_library, aliexpress_search (ou cj_search), (web_search OU ask_perplexity) pour le benchmark prix, search_ad_benchmarks. Si l\'un est manquant, l\'appeler d\'abord.\n\nPropose a final niche to the operator with a structured payload. The UI renders this as a "Lancer cette niche" card with a button that pre-fills the store-creation form below. featured_product, media_plan and design_proposals (exactly 3) are ALL REQUIRED — a shortlist without them is incomplete and will be rejected. When you have ran aliexpress_search or cj_search and identified a clear winner among the candidates, copy its fields verbatim into `featured_product`.',
    input_schema: {
      type: 'object',
      properties: {
        niche: {
          type: 'string',
          description: 'Final niche keyword, lowercase, 1-4 words, English or French.',
        },
        rationale: {
          type: 'string',
          description: '2-3 sentences explaining why this niche scores well now. No em-dashes.',
        },
        saturation: {
          type: 'number',
          description: '0-100 from meta_ads_library, when available.',
        },
        estimated_aov_eur: {
          type: 'number',
          description: 'Plausible average order value in euros, if known.',
        },
        suggested_store_name: {
          type: 'string',
          description: 'Premium-sounding store name, 1-3 words.',
        },
        target_audience: {
          type: 'string',
          description: 'One-sentence audience description.',
        },
        featured_product: {
          type: 'object',
          description:
            'The hero product the operator should start the store with. Copy these fields VERBATIM from one of the aliexpress_search / cj_search candidates you already ran (do not invent URLs or images — they must point to a real supplier listing).',
          properties: {
            supplier: { type: 'string', enum: ['aliexpress', 'cj'] },
            supplier_product_id: { type: 'string' },
            title: { type: 'string' },
            image_url: { type: 'string', description: 'Product image URL from the supplier candidate.' },
            supplier_url: { type: 'string', description: 'Supplier product page URL.' },
            cost_cents: {
              type: 'number',
              description:
                'Supplier cost in EUR cents — copy verbatim from the candidate.',
            },
            suggested_price_cents: {
              type: 'number',
              description:
                'YOUR recommended retail TTC in EUR cents, grounded in the market benchmark you ran (Amazon FR, DTC competitor). Do NOT blindly forward the supplier candidate\'s `suggested_price_cents` — that one is cost × 2.2 and is too high in most cases. Must yield a gross margin ≥ 10 € after ~2 € shipping.',
            },
            orders: { type: 'number' },
            rating: { type: 'string' },
            why_this_one: {
              type: 'string',
              description:
                'One sentence: why this specific candidate over the other ones in the same search (price/orders/format/visual appeal).',
            },
            pricing_rationale: {
              type: 'string',
              description:
                'One sentence on WHY you set suggested_price_cents to that exact value. Must reference your market benchmark (e.g. "Amazon FR 22-28€, marge brute 13€, sous la barre psychologique 25€").',
            },
            expected_aov_eur: {
              type: 'number',
              description:
                'Expected AOV after bundle uplift, in euros. If unit retail < 30€, bundle 2/3 units to lift AOV — state the resulting expected AOV here.',
            },
          },
          required: ['supplier', 'supplier_product_id', 'title', 'image_url', 'supplier_url', 'cost_cents', 'suggested_price_cents'],
        },
        suggested_mode: {
          type: 'string',
          enum: ['mono', 'collection'],
          description:
            'Catalog shape: "mono" for a single hero SKU long-form landing, "collection" for 3-6 curated pieces. Decide from the niche signal: editorial / story-driven → collection ; one breakout SKU → mono.',
        },
        suggested_template: {
          type: 'string',
          enum: [...TEMPLATE_IDS],
          description: `Storefront template id (${TEMPLATE_CATALOG.length} options). Pick from the catalog that best matches niche vibe, register (mass/premium/luxury), and product count. Catalog:\n${TEMPLATE_CATALOG.map((t) => `  • ${t.id} (${t.register}/${t.mode}; ${t.niches.join(',') || 'any'}): ${t.hint}`).join('\n')}`,
        },
        media_plan: {
          type: 'object',
          description:
            'Full media plan the operator will use to launch ads. Required when supply + market + audience are clear. Anchored in current saturation (Meta library) + market benchmark.',
          properties: {
            daily_budget_eur: {
              type: 'number',
              description: 'Recommended starting daily total budget across all channels.',
            },
            channels: {
              type: 'array',
              description: 'Channel mix with budget weights summing to ~100%.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', enum: ['meta', 'tiktok', 'google', 'pinterest'] },
                  weight_pct: { type: 'number', description: 'Share of total budget (0-100).' },
                  expected_cpm_eur: { type: 'number' },
                  expected_cpc_eur: { type: 'number' },
                  expected_cpa_eur: { type: 'number' },
                  rationale: { type: 'string', description: 'One sentence: why this channel for this niche.' },
                },
                required: ['name', 'weight_pct'],
              },
            },
            geo: {
              type: 'object',
              properties: {
                primary_countries: {
                  type: 'array',
                  description: 'ISO-3166 2-letter country codes, ordered by priority.',
                  items: { type: 'string' },
                },
                emphasis: {
                  type: 'array',
                  description: 'Cities / regions to over-index (e.g. "Paris", "Île-de-France", "Lyon").',
                  items: { type: 'string' },
                },
                rationale: { type: 'string' },
              },
              required: ['primary_countries'],
            },
            audience: {
              type: 'object',
              properties: {
                demographics: { type: 'string', description: 'e.g. "Femmes 28-45, parents enfants 0-6 ans, CSP+".' },
                interests: {
                  type: 'array',
                  description: 'Meta-style interest keywords.',
                  items: { type: 'string' },
                },
                lookalike_seeds: {
                  type: 'array',
                  description: 'Lookalike audience seed sources (e.g. "Veilleuse Magique", "Maisons du Monde").',
                  items: { type: 'string' },
                },
              },
              required: ['demographics', 'interests'],
            },
            schedule: {
              type: 'object',
              properties: {
                best_hours_local: {
                  type: 'array',
                  description: 'e.g. ["20h-22h", "07h-09h"]',
                  items: { type: 'string' },
                },
                best_days: {
                  type: 'array',
                  description: 'e.g. ["dimanche", "mercredi"]',
                  items: { type: 'string' },
                },
                timezone: { type: 'string', description: 'IANA TZ, default Europe/Paris.' },
                rationale: { type: 'string' },
              },
              required: ['best_hours_local', 'best_days'],
            },
            expected_outcomes: {
              type: 'object',
              properties: {
                daily_orders_low: { type: 'number' },
                daily_orders_high: { type: 'number' },
                target_cpa_eur: { type: 'number' },
                target_roas: { type: 'number', description: 'Target ROAS (revenue/spend).' },
                breakeven_note: { type: 'string' },
              },
              required: ['daily_orders_low', 'daily_orders_high', 'target_cpa_eur', 'target_roas'],
            },
            top_hooks: {
              type: 'array',
              description: '3 short ad-hook ideas tailored to the audience.',
              items: { type: 'string' },
            },
          },
          required: ['daily_budget_eur', 'channels', 'geo', 'audience', 'schedule', 'expected_outcomes'],
        },
        design_proposals: {
          type: 'array',
          description:
            'EXACTLY 3 design candidates the operator picks from in the chat. Each is one of the 5 curated presets (editorial-serif, tech-mono, brutalist-luxe, gen-z-bold, lifestyle-warm) plus the primary+accent hex colors you recommend for THIS niche. Choose the 3 presets that best fit the audience (e.g. for "pet care" propose lifestyle-warm + editorial-serif + gen-z-bold). Each accent must visually contrast its primary. Once the operator picks one in the chat, those exact colors are LOCKED — no other component is allowed to invent new ones.',
          items: {
            type: 'object',
            properties: {
              preset: {
                type: 'string',
                enum: [
                  'editorial-serif',
                  'tech-mono',
                  'brutalist-luxe',
                  'gen-z-bold',
                  'lifestyle-warm',
                ],
              },
              primary: {
                type: 'string',
                description: 'Brand primary color, #RRGGBB hex. Used for CTAs, links, accents on dark surfaces.',
              },
              accent: {
                type: 'string',
                description: 'Brand accent color, #RRGGBB hex. Used sparingly for highlights, badges, glow.',
              },
              rationale: {
                type: 'string',
                description: 'One sentence on why this preset+palette suits the niche.',
              },
            },
            required: ['preset', 'primary', 'accent', 'rationale'],
          },
        },
      },
      required: ['niche', 'rationale', 'suggested_store_name', 'featured_product', 'media_plan', 'design_proposals'],
    },
  },
];

// ── Public types ───────────────────────────────────────────────────────

export interface ResearchStreamEvent {
  type:
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'message'
    | 'shortlist'
    | 'done'
    | 'error';
  data: unknown;
}

interface FeaturedProduct {
  supplier: 'aliexpress' | 'cj';
  supplier_product_id: string;
  title: string;
  image_url: string;
  supplier_url: string;
  cost_cents: number;
  suggested_price_cents: number;
  orders?: number;
  rating?: string | null;
  why_this_one?: string;
  pricing_rationale: string;
  expected_aov_eur?: number;
}

interface DesignProposal {
  preset:
    | 'editorial-serif'
    | 'tech-mono'
    | 'brutalist-luxe'
    | 'gen-z-bold'
    | 'lifestyle-warm';
  primary: string;
  accent: string;
  rationale: string;
}

interface ShortlistPayload {
  niche: string;
  rationale: string;
  saturation?: number;
  estimated_aov_eur?: number;
  suggested_store_name: string;
  target_audience?: string;
  featured_product: FeaturedProduct;
  suggested_mode?: 'mono' | 'collection';
  suggested_template?: string;
  media_plan: z.infer<typeof MediaPlanInput>;
  design_proposals: DesignProposal[];
}

/**
 * Research-specific tool result that adds a `shortlist` payload for the
 * shortlist_niche tool which triggers a UI side-effect.
 */
interface ResearchToolResult {
  output: unknown;
  /** Short human-readable label shown in the inline tool card. */
  summary: string;
  /** Optional structured payload to bubble up as a stream event. */
  shortlist?: ShortlistPayload;
}

// ── DB helpers ─────────────────────────────────────────────────────────

async function loadHistory(sessionId: string) {
  const db = getDb();
  const { rows } = await db.query<
    import('./copilot-shared').StoredMessage
  >(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_copilot_messages
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
    `INSERT INTO dropship_copilot_messages
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
    `UPDATE dropship_copilot_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function maybeBackfillTitle(sessionId: string, firstUserMessage: string): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<{ title: string | null }>(
    `SELECT title FROM dropship_copilot_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  if (rows[0]?.title) return;
  const title = firstUserMessage.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return;
  await db.query(
    `UPDATE dropship_copilot_sessions SET title = $1 WHERE id = $2 AND title IS NULL`,
    [title, sessionId],
  );
}

// ── System prompt ──────────────────────────────────────────────────────

/**
 * Compute the current temporal context the agent needs.
 *
 * Claude's training cutoff is mid-2025; without an anchor it will hallucinate
 * dates (operators reported it saying "we're in mid-November" while it was
 * May). We inject the actual server clock + the upcoming commercial events
 * so seasonal recommendations (Noël, Black Friday, fête des mères…) are
 * grounded in reality.
 */
export function buildTemporalContext(): string {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const longFr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const month = now.getMonth(); // 0-11
  const day = now.getDate();
  const year = now.getFullYear();

  const SEASON_BY_MONTH = [
    'hiver', 'hiver',                                  // jan, feb
    'printemps', 'printemps', 'printemps',             // mar, apr, may
    'été', 'été', 'été',                                // jun, jul, aug
    'automne', 'automne', 'automne',                   // sep, oct, nov
    'hiver',                                           // dec
  ];
  const season = SEASON_BY_MONTH[month];

  // Returns the last occurrence of a given weekday (0=Sun…6=Sat) in a month.
  const lastWeekdayOfMonth = (y: number, m: number, dow: number): Date => {
    const last = new Date(y, m + 1, 0); // last day of month
    const diff = (last.getDay() - dow + 7) % 7;
    return new Date(y, m, last.getDate() - diff);
  };
  // Returns the Nth occurrence of a weekday in a month (1-indexed).
  const nthWeekdayOfMonth = (y: number, m: number, dow: number, n: number): Date => {
    const first = new Date(y, m, 1);
    const diff = (dow - first.getDay() + 7) % 7;
    return new Date(y, m, 1 + diff + (n - 1) * 7);
  };

  const blackFriday = lastWeekdayOfMonth(year, 10, 5); // last Friday of November
  const cyberMonday = new Date(blackFriday.getFullYear(), blackFriday.getMonth(), blackFriday.getDate() + 3);

  // Upcoming commercial events relevant for dropshipping in FR.
  // Roughly ordered by date. We surface the next 2 within ~90 days.
  const events: Array<{ date: Date; label: string }> = [
    { date: new Date(year, 0, 6),                           label: 'soldes d\'hiver (FR, début janvier)' },
    { date: new Date(year, 1, 14),                          label: 'Saint-Valentin (14 février)' },
    { date: lastWeekdayOfMonth(year, 4, 0),                 label: 'fête des mères FR (dernier dim. mai)' },
    { date: new Date(year, 5, 28),                          label: 'soldes d\'été (FR, fin juin → fin juillet)' },
    { date: nthWeekdayOfMonth(year, 5, 0, 3),               label: 'fête des pères FR (3e dim. juin)' },
    { date: new Date(year, 8, 1),                           label: 'rentrée scolaire (début septembre)' },
    { date: new Date(year, 9, 31),                          label: 'Halloween (31 octobre)' },
    { date: blackFriday,                                    label: 'Black Friday (dernier vendredi nov.)' },
    { date: cyberMonday,                                    label: 'Cyber Monday (lundi suivant Black Friday)' },
    { date: new Date(year, 11, 25),                         label: 'Noël (25 décembre)' },
  ];
  const upcoming = events
    .map((e) => ({ ...e, daysAway: Math.round((e.date.getTime() - now.getTime()) / 86_400_000) }))
    .filter((e) => e.daysAway >= -7 && e.daysAway <= 100)
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 3)
    .map((e) => `${e.label} ${e.daysAway >= 0 ? `dans ${e.daysAway}j` : `il y a ${-e.daysAway}j`}`)
    .join(' · ');

  return [
    '=== Temporal context (server clock, do not override) ===',
    `Aujourd'hui : ${longFr} (ISO ${isoDate}). Mois en cours : ${monthFr(month)} ${year}. Saison : ${season}.`,
    upcoming
      ? `Événements commerciaux proches : ${upcoming}.`
      : 'Aucun événement commercial majeur dans les 100 prochains jours.',
    `Jour ${day} du mois. NEVER assume a different date or month. NEVER say "on est en novembre" unless ISO date confirms it. If a temporal claim matters (trend "actuel", produit "tendance", saisonnalité), call web_search with a query that includes the current year (${year}) before answering.`,
    '=== End temporal context ===',
  ].join('\n');
}

function monthFr(monthIndex: number): string {
  return [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ][monthIndex] ?? 'mois';
}

function buildSystemPrompt(): string {
  const tavilyOk = isTavilyConfigured();
  const perplexityOk = isPerplexityConfigured();
  return [
    buildTemporalContext(),
    '',
    'You are a senior dropshipping market analyst embedded in the admin of a French AI dropshipping platform.',
    '',
    'Your job is to help the operator find a winning niche BEFORE they create a store. You research via tools (web search, Perplexity, Meta Ads Library, AliExpress / CJ supplier search) and converge on a single recommendation.',
    '',
    'Rules:',
    '- Speak French. The operator is French. Switch to English only if the operator does first.',
    '- Maximum 6 tool calls per user turn. Do not call the same tool with the same arguments twice.',
    '- When a tool returns nothing usable, say so plainly and try a different angle instead of looping.',
    '- Saturation > 70 means crowded — explicitly warn the operator. Saturation 30-70 = competitive. < 30 = open.',
    '- After every tool call, synthesize in 2-3 actionable bullets before continuing. Format: [Chiffre-clé] / [Interprétation] / [Prochaine étape]. Never reply with a single word or sentence after a tool result.',
    `- If BOTH web_search (Tavily) AND ask_perplexity (Sonar) are NOT configured, do NOT call shortlist_niche. Inform the operator that mandatory integrations are missing and stop the analysis.`,
    '',
    'Mandatory analysis sequence before `shortlist_niche` (DO NOT skip any step):',
    '1. **Saturation check** — call meta_ads_library on the candidate niche. Reject niches with saturation > 75.',
    '2. **Supply check** — call aliexpress_search (and cj_search if relevant). Pick the strongest candidate: cost in EUR cents, ≥30 orders for social proof, rating ≥85%.',
    '3. **Market price benchmark — NON OPTIONAL**. Call web_search OR ask_perplexity to find the real retail price the product sells for on the French market (Amazon FR, established DTC competitors, prix moyen constaté). The `suggested_price_cents` returned by the supplier tools is a naive cost × 2.2 estimate — IGNORE IT for the operator-facing price.',
    '4. **Ad cost benchmarks — NON OPTIONAL**. Call `search_ad_benchmarks` with the exact niche and country. This tool fetches real CPM/CPC/CPA data for Meta Ads, TikTok Ads, Google Ads and Pinterest Ads specific to this niche and market. NEVER invent ad costs — use the numbers that come back. If `search_ad_benchmarks` returns data, use it verbatim in your media_plan.',
    '5. **Unit economics check** — compute three pricing scenarios (aggressive / balanced / premium) with: retail TTC, shipping ~2€, cost, gross margin €. Then qualify each: CPA-cible (from the ad benchmarks data), ROAS attendu, viability "FB Ads débutant" vs "branding requis".',
    '6. **Bundle strategy** — if unit retail < 30€, propose a 2-unit and 3-unit bundle to lift AOV. State the expected AOV after bundles.',
    `7. **Storefront shape** — decide \`suggested_mode\` ("mono" for one hero SKU long-form, "collection" for 3-6 curated pieces) AND \`suggested_template\` (id from the storefront catalog — ${TEMPLATE_CATALOG.length} options spanning mass/premium/luxury and fashion/beauty/wellness/events/travel/etc., see the tool schema for the full list with hints). Match the template's niches[] and register to the niche signal. The operator should NOT have to re-pick.`,
    '8. **Media plan — DO NOT SKIP**. Produce a full `media_plan` using the REAL ad cost data from `search_ad_benchmarks`. Channels with weight_pct summing ~100, expected CPM/CPC/CPA per channel (from benchmarks), geo (primary_countries + emphasis cities/régions), audience (demographics + interests + lookalike_seeds), schedule (best_hours_local + best_days + timezone Europe/Paris), expected_outcomes (daily_orders_low/high, target_cpa_eur, target_roas, breakeven_note), and 3 top_hooks. The operator validates this visually BEFORE creating the store.',
    '9. **Design proposals — DO NOT SKIP**. Provide EXACTLY 3 entries in `design_proposals`. Each is one of the 5 curated presets (`editorial-serif`, `tech-mono`, `brutalist-luxe`, `gen-z-bold`, `lifestyle-warm`) with the recommended `primary` + `accent` hex colors for THIS niche. Hard rules: (a) the 3 must be visually distinct from each other so the operator has a real choice; (b) the colors must respect the niche emotional tone (pet care → warm earthy; tech gadget → cold deep blue or near-black; luxury → near-black + ivory; gen-z fitness → saturated lime or magenta); (c) each accent must contrast its primary; (d) NEVER use the default placeholder #0f172a / #6366f1 — those are the legacy app neutrals and look generic. Once the operator picks one in the chat, those exact colors become the LAW for the whole storefront, the cookie banner, the ads creatives, every CTA. No component will ever invent a new color afterwards.',
    '',
    '- The operator paid Opus 4.7 to do the pricing work — never propose a retail price without having benchmarked it against the market. Never lazily round `cost × 2.2`.',
    '- A healthy gross margin floor is ~12€ on the chosen retail (otherwise FB Ads débutant burns cash). Reject any combo that gives < 10€ margin.',
    '',
    '──── LUXURY PLAY (15→300 framing) ────',
    'If the operator\'s prompt contains any of these signals — "luxe", "luxury", "premium", "haut de gamme", "300", "perception", "300 dollars", "vendre cher", "Hermès", "Aesop", "made-to-order" — switch into LUXURY PLAY mode. In this mode the strategy is NOT to find a fair-margin product, it is to find a commodity AliExpress SKU that has an EXISTING DTC premium counterpart we can anchor to, then mark it up 10-20×.',
    'LUXURY PLAY rules:',
    '  a) **Existing DTC premium anchor is mandatory.** Use ask_perplexity + web_search to confirm a recognized DTC brand sells the same category at 80€+ (examples: Aspinal of London / Bellroy for petite maroquinerie ; Mejuri / Missoma for jewelry ; Aesop / Cire Trudon / Le Labo for home rituals ; Mount Lai / Wildling for beauty tools ; Smythson / Moleskine for stationery ; Yamazaki / Hasami for kitchen objects). If no premium DTC anchor exists, ABORT the luxury play — propose a different niche.',
    '  b) **Photogenic materiality is mandatory.** Favor cuir, métal brossé, laiton, céramique, pierre, verre soufflé, bois noueux. Reject plastic, silicone, electronic gadgets, anything with foreign-language printing on it. The product must survive a studio lighting close-up without screaming "AliExpress".',
    '  c) **Compute the retail/cost ratio.** Take the DTC premium anchor price (lowest competitor SKU) and divide by the AliExpress supplier cost. Target ratio ≥ 10×. State this ratio explicitly in `pricing_rationale` (e.g. "Aspinal porte-cartes 95€, supplier 8€, ratio 11.9×, marge brute 82€ après shipping").',
    '  d) **Suggested template MUST be from the luxury register.** Pick `luxury-mono` (mono-product editorial, made-to-order framing — best fit for the 15→300 play), `luxury-minimal` (b&w typographique sobre), `fiora-locks-wh1270` (Cormorant Garamond géant, fond crème), `editorial-fashion`, or `wellness-massage-quiet`. NEVER pick `mono`, `collection-grid`, `gen-z-bold`, or anything with `register: \'mass\'` in luxury play mode.',
    '  e) **Retail pricing**: set `suggested_price_cents` to 60-80% of the DTC anchor price (not 200% of cost). The customer is comparing to Aspinal/Aesop, not to AliExpress. Undercut the anchor slightly to feel like a discovery, not a cheaper alternative.',
    '  f) **Mode**: always `mono` in luxury play. Long-form editorial landing on one hero SKU, not a 6-product grid.',
    '  g) **Media plan**: lean toward Meta + Pinterest (story-driven, image-led). TikTok works only if the niche has a beauty/ritual angle. Audience targeting on "luxury craft", "slow living", "handmade", lookalikes from Aesop / Cire Trudon / Aspinal followers when possible.',
    '  h) **Ad hooks**: write `top_hooks` in luxury voice — "Fait à la commande, pas en série." / "L\'objet patine sans s\'effacer." / "Six semaines de production. Le rythme d\'un objet qui dure." NEVER write urgency ("Stock limité", "Dernière chance") in luxury play mode.',
    '──── END LUXURY PLAY ────',
    '',
    '- ALWAYS call `shortlist_niche` once the analysis above is complete. It is how the UI surfaces the "Lancer cette niche" button + the design picker. Treat it as a contract: the operator should not have to re-pick mode/template/budget/audience/colors/typo after seeing your card.',
    '- When `shortlist_niche` is called, ALWAYS pass the winning candidate as `featured_product`. Set `suggested_price_cents` to YOUR balanced-scenario retail price (in cents) — not the naive supplier estimate. Set `pricing_rationale` to one short sentence explaining why this price (e.g. "Aligné Amazon FR 22-28€, marge 13€, sweet spot psychologique sous 25€").',
    '- No em-dashes (—). No three-beat triads. Write tight, concrete French. Numbers, ranges, names.',
    '',
    'Tool availability:',
    `- web_search (Tavily): ${tavilyOk ? 'configured' : 'NOT configured (returns [])'}`,
    `- ask_perplexity (Sonar): ${perplexityOk ? 'configured' : 'NOT configured (returns empty answer)'}`,
    '- meta_ads_library: always available (HTML scrape + Claude fallback)',
    '- aliexpress_search: live, may rate-limit',
    '- cj_search: may be unconfigured (returns [])',
  ].join('\n');
}

// ── Tool executors ─────────────────────────────────────────────────────

async function execWebSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = WebSearchInput.parse(raw);
  const results = await tavilySearch({
    query: input.query,
    max_results: 5,
    topic: input.topic,
    search_depth: 'basic',
  });
  return {
    output: { query: input.query, topic: input.topic, results },
    summary: `Recherche web "${input.query}" — ${results.length} résultat${results.length === 1 ? '' : 's'}`,
  };
}

async function execAskPerplexity(raw: unknown): Promise<ResearchToolResult> {
  const input = AskPerplexityInput.parse(raw);
  const { answer, citations } = await perplexityAnswer(input.query);
  return {
    output: { query: input.query, answer, citations },
    summary: answer ? `Perplexity: ${answer.slice(0, 80)}…` : 'Perplexity: réponse vide',
  };
}

async function execMetaAdsLibrary(raw: unknown): Promise<ResearchToolResult> {
  const input = MetaAdsLibraryInput.parse(raw);
  const result = await validateNiche(input.niche, {
    country: (input.country ?? 'FR') as ValidatorCountry,
  });
  return {
    output: result,
    summary: `Meta Ads Library "${input.niche}" — saturation ${result.saturation}/100 (${result.verdict})`,
  };
}

async function execAliexpressSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = SupplierSearchInput.parse(raw);
  const limit = Math.min(20, input.limit ?? 10);
  const res = await aliexpress.searchProducts({
    keywords: input.query,
    pageSize: limit,
    currency: 'EUR',
    countryCode: 'FR',
    locale: 'fr_FR',
  });
  if (!res.success || !res.data) {
    return {
      output: {
        query: input.query,
        candidates: [],
        error: res.error ?? 'AliExpress: erreur inconnue',
      },
      summary: `AliExpress "${input.query}" — erreur (${res.error ?? 'inconnu'})`,
    };
  }
  const candidates = res.data.products.slice(0, limit).map((p) => {
    const costCents = Math.max(0, Math.round(parseFloat(p.sale_price || p.original_price || '0') * 100));
    const retailCents = Math.max(999, Math.round((costCents * 2.2) / 100) * 100 - 1);
    const ordersParsed = parseInt(p.thirty_days_sold_count || '0', 10);
    return {
      supplier: 'aliexpress' as const,
      supplier_product_id: p.product_id,
      title: p.product_title,
      image_url: p.product_main_image_url,
      supplier_url: p.product_url,
      cost_cents: costCents,
      suggested_price_cents: retailCents,
      margin_cents: retailCents - costCents,
      orders: Number.isFinite(ordersParsed) ? ordersParsed : 0,
      rating: p.evaluate_rate || null,
    };
  });
  return {
    output: { query: input.query, candidates, total_found: res.data.total_record_count },
    summary: `AliExpress "${input.query}" — ${candidates.length} produit${candidates.length === 1 ? '' : 's'}`,
  };
}

async function execCjSearch(raw: unknown): Promise<ResearchToolResult> {
  const input = SupplierSearchInput.parse(raw);
  const limit = Math.min(20, input.limit ?? 10);
  let res;
  try {
    res = await cj.searchProducts({ keywords: input.query, pageSize: limit });
  } catch (e) {
    // CJ frequently 401s when the key is invalid — never crash the loop.
    return {
      output: {
        query: input.query,
        candidates: [],
        error: e instanceof Error ? e.message : String(e),
      },
      summary: `CJ "${input.query}" — indisponible`,
    };
  }
  if (!res.success || !res.data) {
    return {
      output: {
        query: input.query,
        candidates: [],
        error: res.error ?? 'CJ: erreur inconnue',
      },
      summary: `CJ "${input.query}" — ${res.error ?? 'indisponible'}`,
    };
  }
  const candidates = res.data.list.slice(0, limit).map((p) => {
    const costCents = Math.max(0, Math.round(p.sellPrice * 100));
    const retailCents = Math.max(999, Math.round((costCents * 2.2) / 100) * 100 - 1);
    return {
      supplier: 'cj' as const,
      supplier_product_id: p.pid,
      title: p.productNameEn,
      image_url: p.productImage,
      supplier_url: p.sellUrl,
      cost_cents: costCents,
      suggested_price_cents: retailCents,
      margin_cents: retailCents - costCents,
      orders: 0,
      rating: null,
    };
  });
  return {
    output: { query: input.query, candidates, total_found: res.data.total },
    summary: `CJ "${input.query}" — ${candidates.length} produit${candidates.length === 1 ? '' : 's'}`,
  };
}

async function execAdBenchmarks(raw: unknown): Promise<ResearchToolResult> {
  const input = AdBenchmarksInput.parse(raw);
  const country = input.country ?? 'FR';
  const countryLabel: Record<string, string> = {
    FR: 'France', BE: 'Belgique', CH: 'Suisse', CA: 'Canada', US: 'États-Unis', UK: 'Royaume-Uni',
  };
  const label = countryLabel[country] ?? country;

  const query =
    `Benchmarks publicitaires e-commerce dropshipping "${input.niche}" ${label} 2025 2026: ` +
    `Meta Ads (Facebook/Instagram) CPM moyen EUR, CPC moyen EUR, CPA moyen EUR pour ce type de produit; ` +
    `TikTok Ads CPM moyen EUR, CPC moyen EUR; ` +
    `Google Shopping / Google Ads CPC moyen EUR; ` +
    `Pinterest Ads CPM moyen EUR. ` +
    `Quel canal a le meilleur ROAS pour "${input.niche}" et pourquoi? ` +
    `Quels jours de la semaine et créneaux horaires ont les meilleurs taux de conversion pour "${input.niche}" en ${label}?`;

  let rawText: string;
  let citations: string[];
  let summarySource: string;

  try {
    const result = await perplexityAnswer(query);
    rawText = result.answer ?? '';
    citations = result.citations ?? [];
    summarySource = 'Perplexity';
  } catch {
    // Fallback vers Tavily si Perplexity échoue
    const results = await tavilySearch({ query, max_results: 5 });
    rawText = results.map((r) => r.snippet).join('\n\n');
    citations = results.map((r) => r.url);
    summarySource = 'web search';
  }

  // Post-process via Haiku to extract structured numeric benchmarks.
  // Reduces hallucination risk when Claude must fill media_plan fields.
  let structured: Record<string, unknown> | null = null;
  try {
    const extraction = await trackedMessage(
      { step: 'ad-benchmarks-extraction', storeId: null },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'Extract advertising benchmark numbers from the provided text. Return ONLY valid JSON. If a value is not found, use null.',
        messages: [
          {
            role: 'user',
            content: `Text:\n${rawText}\n\nReturn JSON with this exact shape:\n{"meta":{"cpm_eur":number|null,"cpc_eur":number|null,"cpa_eur":number|null},"tiktok":{"cpm_eur":number|null,"cpc_eur":number|null,"cpa_eur":number|null},"google":{"cpc_eur":number|null,"cpa_eur":number|null},"pinterest":{"cpm_eur":number|null},"best_channel":string|null,"best_days":string[]|null,"best_hours":string[]|null}`,
          },
        ],
      },
    );
    const textBlock = extraction.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) structured = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Non-fatal — fall back to raw text only
  }

  return {
    output: {
      niche: input.niche,
      country,
      benchmarks: rawText,
      structured: structured ?? undefined,
      citations,
    },
    summary: `Ad benchmarks "${input.niche}" (${country}) — ${summarySource}${structured ? ' (structuré)' : ''}`,
  };
}

function execShortlistNiche(raw: unknown): ResearchToolResult {
  const input = ShortlistNicheInput.parse(raw);
  if (input.saturation !== undefined && input.saturation > 75) {
    throw new Error(
      `Saturation ${input.saturation}/100 > 75 — niche rejetée. Propose une niche alternative avec saturation ≤ 75.`,
    );
  }
  const payload: ShortlistPayload = {
    niche: input.niche.trim().toLowerCase(),
    rationale: input.rationale.trim(),
    suggested_store_name: input.suggested_store_name.trim(),
    saturation: input.saturation,
    estimated_aov_eur: input.estimated_aov_eur,
    target_audience: input.target_audience?.trim() || undefined,
    featured_product: {
      supplier: input.featured_product.supplier,
      supplier_product_id: input.featured_product.supplier_product_id,
      title: input.featured_product.title.trim(),
      image_url: input.featured_product.image_url,
      supplier_url: input.featured_product.supplier_url,
      cost_cents: input.featured_product.cost_cents,
      suggested_price_cents: input.featured_product.suggested_price_cents,
      orders: input.featured_product.orders,
      rating: input.featured_product.rating ?? null,
      why_this_one: input.featured_product.why_this_one?.trim() || undefined,
      pricing_rationale: input.featured_product.pricing_rationale.trim(),
      expected_aov_eur: input.featured_product.expected_aov_eur,
    },
    suggested_mode: input.suggested_mode,
    suggested_template: input.suggested_template,
    media_plan: input.media_plan,
    design_proposals: input.design_proposals.map((d) => ({
      preset: d.preset,
      primary: d.primary.toLowerCase(),
      accent: d.accent.toLowerCase(),
      rationale: d.rationale.trim(),
    })),
  };
  return {
    output: payload,
    summary: `Shortlist: ${payload.niche} → ${payload.suggested_store_name}`,
    shortlist: payload,
  };
}

type ToolName =
  | 'web_search'
  | 'ask_perplexity'
  | 'meta_ads_library'
  | 'aliexpress_search'
  | 'cj_search'
  | 'search_ad_benchmarks'
  | 'shortlist_niche';

async function executeTool(name: string, input: unknown): Promise<ResearchToolResult> {
  switch (name as ToolName) {
    case 'web_search':
      return execWebSearch(input);
    case 'ask_perplexity':
      return execAskPerplexity(input);
    case 'meta_ads_library':
      return execMetaAdsLibrary(input);
    case 'aliexpress_search':
      return execAliexpressSearch(input);
    case 'cj_search':
      return execCjSearch(input);
    case 'search_ad_benchmarks':
      return execAdBenchmarks(input);
    case 'shortlist_niche':
      return execShortlistNiche(input);
    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}

// ── Public entry points ────────────────────────────────────────────────

/**
 * Create a research session. Optional title (rarely set up-front; the
 * first user message backfills it on send).
 */
export async function createResearchSession(title?: string): Promise<string> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_copilot_sessions (title, mode) VALUES ($1, 'research') RETURNING id`,
    [title?.slice(0, 80) ?? null],
  );
  return rows[0]!.id;
}

/**
 * Stream a single chat turn. Each yielded event is JSON-serializable so
 * the SSE route can pass it straight to the wire. Same generator pattern
 * as curation-copilot — buffered event queue + worker promise.
 */
export async function* runResearchTurn(
  sessionId: string,
  userMessage: string,
): AsyncGenerator<ResearchStreamEvent> {
  const events: ResearchStreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let runDone = false;

  const emit = (e: ResearchStreamEvent) => {
    events.push(e);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const run = async () => {
    try {
      // Persist the user message first so a mid-turn crash still leaves a
      // queryable history.
      await insertMessage(sessionId, { role: 'user', content: userMessage });
      await maybeBackfillTitle(sessionId, userMessage);

      const history = await loadHistory(sessionId);
      const messages = rebuildMessages(history);

      // storeId is null on purpose: the store doesn't exist yet.
      await runContext.run({ storeId: null }, async () => {
        let loops = 0;
        let toolCallsThisTurn = 0;
        let finalAssistantText = '';

        while (loops < MAX_TOOL_LOOPS) {
          loops++;

          const response = await trackedMessage(
            { step: 'research-turn', storeId: null },
            {
              model: RESEARCH_MODEL,
              max_tokens: 4096,
              system: buildSystemPrompt(),
              tools: TOOLS,
              messages,
            },
          );

          const textBlocks = response.content.filter(
            (b) => b.type === 'text',
          ) as Array<Extract<typeof response.content[number], { type: 'text' }>>;
          const toolUseBlocks = response.content.filter(
            (b) => b.type === 'tool_use',
          ) as Array<Extract<typeof response.content[number], { type: 'tool_use' }>>;
          const assistantText = textBlocks.map((b) => b.text).join('\n').trim();

          if (assistantText) {
            emit({ type: 'thinking', data: { text: assistantText } });
            finalAssistantText = assistantText;
          }

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
            await insertMessage(sessionId, {
              role: 'assistant',
              content: finalAssistantText,
            });
            emit({ type: 'message', data: { text: finalAssistantText } });
            emit({ type: 'done', data: { text: finalAssistantText } });
            return;
          }

          if (assistantText) {
            await insertMessage(sessionId, {
              role: 'assistant',
              content: assistantText,
            });
          }

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (toolCallsThisTurn >= MAX_TOOLS_PER_TURN) {
              const msg = `Maximum d'appels d'outils par tour atteint (${MAX_TOOLS_PER_TURN}).`;
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
            let shortlist: ShortlistPayload | undefined;
            try {
              const result = await executeTool(block.name, block.input);
              toolOutput = result.output;
              summary = result.summary;
              shortlist = result.shortlist;
            } catch (e) {
              isError = true;
              const message = e instanceof Error ? e.message : String(e);
              const zodIssues =
                e instanceof z.ZodError
                  ? e.errors.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
                  : null;
              toolOutput = {
                error: message,
                ...(zodIssues ? { issues: zodIssues } : {}),
              };
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
              data: {
                id: block.id,
                name: block.name,
                output: toolOutput,
                summary,
                is_error: isError,
              },
            });

            if (shortlist) {
              emit({ type: 'shortlist', data: shortlist });
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: stringifyToolOutput(toolOutput),
              is_error: isError,
            });
          }

          messages.push({ role: 'user', content: toolResults });
        }

        const calledTools = [
          ...new Set(
            messages
              .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
              .filter((b) => b.type === 'tool_use')
              .map((b) => (b as { type: 'tool_use'; name: string }).name),
          ),
        ];
        const guardMsg = [
          `Limite d'analyse atteinte (${MAX_TOOL_LOOPS} tours).`,
          calledTools.length
            ? `Étapes complétées : ${calledTools.join(', ')}.`
            : 'Aucune étape complétée.',
          'Envoie un nouveau message pour continuer.',
        ].join(' ');
        await insertMessage(sessionId, { role: 'assistant', content: guardMsg });
        emit({ type: 'message', data: { text: guardMsg } });
        emit({ type: 'done', data: { text: guardMsg } });
      });
    } catch (e) {
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
}

// Named export so the hub router can use the same model without hardcoding it.
export { RESEARCH_MODEL };

// Internal exports for testing.
export const __internals = {
  TOOLS,
  rebuildMessages,
  buildSystemPrompt,
  executeTool,
  loadHistory,
  insertMessage,
  RESEARCH_MODEL,
};
