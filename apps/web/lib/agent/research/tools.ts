/**
 * Zod input schemas and Anthropic tool surfaces for the research copilot.
 *
 * Split from `research-copilot.ts` for maintainability. The public surface
 * is re-exported via `lib/agent/research-copilot.ts` — do not import this
 * file directly from outside the `research/` directory.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { TEMPLATE_IDS, TEMPLATE_CATALOG } from '@/lib/template-catalog';

// ── Zod schemas for tool inputs ────────────────────────────────────────

export const WebSearchInput = z.object({
  query: z.string().min(2).max(300),
  topic: z.enum(['general', 'news']).optional().default('general'),
});

export const AskPerplexityInput = z.object({
  query: z.string().min(3).max(500),
});

export const MetaAdsLibraryInput = z.object({
  niche: z.string().min(2).max(120),
  country: z.enum(['FR', 'BE', 'CH', 'CA']).optional().default('FR'),
});

export const SupplierSearchInput = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(20).optional().default(10),
});

export const AdBenchmarksInput = z.object({
  niche: z.string().min(2).max(120),
  country: z.enum(['FR', 'BE', 'CH', 'CA', 'US', 'UK']).optional().default('FR'),
});

export const FeaturedProductInput = z.object({
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

export const AdsChannelInput = z.object({
  name: z.enum(['meta', 'tiktok', 'google', 'pinterest']),
  weight_pct: z.number().int().min(0).max(100),
  expected_cpm_eur: z.number().min(0).max(200).optional(),
  expected_cpc_eur: z.number().min(0).max(10).optional(),
  expected_cpa_eur: z.number().min(0).max(200).optional(),
  rationale: z.string().min(0).max(200).optional(),
});

export const MediaPlanInput = z.object({
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
export const HexColor = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be #RRGGBB hex')
  .refine(
    (v) => !PLACEHOLDER_COLORS.includes(v.toLowerCase()),
    { message: 'Color is a generic app placeholder — choose a niche-specific color' },
  );

export const DesignProposalInput = z.object({
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

export const ShortlistNicheInput = z.object({
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

export const TOOLS: Anthropic.Messages.Tool[] = [
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
            'EXACTLY 3 design candidates the operator picks from in the chat. Each is one of the 5 curated **design presets** (editorial-serif, tech-mono, brutalist-luxe, gen-z-bold, lifestyle-warm) plus the primary+accent hex colors you recommend for THIS niche. ⚠️ The `preset` field here is a DESIGN SYSTEM (typo + structure rules) — NOT a storefront template id. NEVER put template ids like `luxury-mono`, `wellness-soft`, `fiora-locks-wh1270` here — those belong to `suggested_template`. For luxury niches, use `brutalist-luxe` or `editorial-serif` as the preset. Choose the 3 presets that best fit the audience (e.g. for "pet care" propose lifestyle-warm + editorial-serif + gen-z-bold). Each accent must visually contrast its primary. Once the operator picks one in the chat, those exact colors are LOCKED — no other component is allowed to invent new ones.',
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
