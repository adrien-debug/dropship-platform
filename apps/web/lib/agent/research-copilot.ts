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
 * Conversations live in `dropship_research_sessions` / `_messages`. They are
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

const RESEARCH_MODEL = 'claude-sonnet-4-6';
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

const ShortlistNicheInput = z.object({
  niche: z.string().min(1).max(80),
  rationale: z.string().min(10).max(800),
  saturation: z.number().min(0).max(100).optional(),
  estimated_aov_eur: z.number().min(0).max(10_000).optional(),
  suggested_store_name: z.string().min(1).max(80),
  target_audience: z.string().min(0).max(400).optional(),
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
    name: 'shortlist_niche',
    description:
      'Propose a final niche to the operator with a structured payload. The UI renders this as a "Lancer cette niche" card with a button that pre-fills the store-creation form below. Always call this once you have a recommendation backed by at least two tool calls (typically meta_ads_library + aliexpress_search).',
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
      },
      required: ['niche', 'rationale', 'suggested_store_name'],
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

export interface ShortlistPayload {
  niche: string;
  rationale: string;
  saturation?: number;
  estimated_aov_eur?: number;
  suggested_store_name: string;
  target_audience?: string;
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

// ── DB helpers ─────────────────────────────────────────────────────────

async function loadHistory(sessionId: string): Promise<StoredMessage[]> {
  const db = getDb();
  const { rows } = await db.query<StoredMessage>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_research_messages
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
    `INSERT INTO dropship_research_messages
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
    `UPDATE dropship_research_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function maybeBackfillTitle(sessionId: string, firstUserMessage: string): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<{ title: string | null }>(
    `SELECT title FROM dropship_research_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  if (rows[0]?.title) return;
  const title = firstUserMessage.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return;
  await db.query(
    `UPDATE dropship_research_sessions SET title = $1 WHERE id = $2 AND title IS NULL`,
    [title, sessionId],
  );
}

// ── Message rebuild (Anthropic format) ─────────────────────────────────

function rebuildMessages(history: StoredMessage[]): Anthropic.Messages.MessageParam[] {
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
        row.tool_input &&
        typeof row.tool_input === 'object' &&
        '__tool_use_id' in row.tool_input
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

// ── System prompt ──────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const tavilyOk = isTavilyConfigured();
  const perplexityOk = isPerplexityConfigured();
  return [
    'You are a senior dropshipping market analyst embedded in the admin of a French AI dropshipping platform.',
    '',
    'Your job is to help the operator find a winning niche BEFORE they create a store. You research via tools (web search, Perplexity, Meta Ads Library, AliExpress / CJ supplier search) and converge on a single recommendation.',
    '',
    'Rules:',
    '- Speak French. The operator is French. Switch to English only if the operator does first.',
    '- Always call AT LEAST ONE tool before making a recommendation. Prefer at least TWO (typically meta_ads_library + aliexpress_search) before calling shortlist_niche.',
    '- Maximum 6 tool calls per user turn. Do not call the same tool with the same arguments twice.',
    '- When a tool returns nothing usable, say so plainly and try a different angle instead of looping.',
    '- Saturation > 70 means crowded — explicitly warn the operator. Saturation 30-70 = competitive. < 30 = open.',
    '- Cost in supplier results is in EUR cents. A healthy retail margin is 2.2x cost minimum.',
    '- ALWAYS call `shortlist_niche` once you have a recommendation. It is how the UI surfaces the "Lancer cette niche" button.',
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

interface ToolExecutionResult {
  output: unknown;
  /** Short human-readable label shown in the inline tool card. */
  summary: string;
  /** Optional structured payload to bubble up as a stream event. Used for
   *  shortlist_niche which triggers a UI side-effect. */
  shortlist?: ShortlistPayload;
}

async function execWebSearch(raw: unknown): Promise<ToolExecutionResult> {
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

async function execAskPerplexity(raw: unknown): Promise<ToolExecutionResult> {
  const input = AskPerplexityInput.parse(raw);
  const { answer, citations } = await perplexityAnswer(input.query);
  return {
    output: { query: input.query, answer, citations },
    summary: answer ? `Perplexity: ${answer.slice(0, 80)}…` : 'Perplexity: réponse vide',
  };
}

async function execMetaAdsLibrary(raw: unknown): Promise<ToolExecutionResult> {
  const input = MetaAdsLibraryInput.parse(raw);
  const result = await validateNiche(input.niche, {
    country: (input.country ?? 'FR') as ValidatorCountry,
  });
  return {
    output: result,
    summary: `Meta Ads Library "${input.niche}" — saturation ${result.saturation}/100 (${result.verdict})`,
  };
}

async function execAliexpressSearch(raw: unknown): Promise<ToolExecutionResult> {
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

async function execCjSearch(raw: unknown): Promise<ToolExecutionResult> {
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

function execShortlistNiche(raw: unknown): ToolExecutionResult {
  const input = ShortlistNicheInput.parse(raw);
  const payload: ShortlistPayload = {
    niche: input.niche.trim().toLowerCase(),
    rationale: input.rationale.trim(),
    suggested_store_name: input.suggested_store_name.trim(),
    saturation: input.saturation,
    estimated_aov_eur: input.estimated_aov_eur,
    target_audience: input.target_audience?.trim() || undefined,
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
  | 'shortlist_niche';

async function executeTool(name: string, input: unknown): Promise<ToolExecutionResult> {
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
    `INSERT INTO dropship_research_sessions (title) VALUES ($1) RETURNING id`,
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

        const guardMsg = `Boucle d'outils maximale atteinte (${MAX_TOOL_LOOPS}).`;
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
