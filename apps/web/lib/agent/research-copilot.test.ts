/**
 * Vitest coverage for the pre-creation research copilot.
 *
 * Same mocking topology as `curation-copilot.test.ts`:
 *   - @/lib/db          : in-memory capture with canned rows + INSERT/UPDATE.
 *   - ./anthropic       : trackedMessage swapped for a programmable queue.
 *   - @/lib/trends/meta-library, @/lib/suppliers/*, @/lib/research/*: spies.
 *
 * The agent's tool-use loop is exercised end-to-end so we assert on:
 *   1. Plain-text turn persists user + assistant.
 *   2-6. Each tool routes to the right backend and persists tool_input /
 *        tool_output rows with the shape the UI relies on.
 *   7. The shortlist_niche tool emits a top-level `shortlist` stream event.
 *   8. Invalid Zod input is captured as a tool error row instead of crashing.
 *   9. createResearchSession inserts a row and returns its UUID.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock ────────────────────────────────────────────────────────────

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];
const inserted: { table: string; sql: string; params: unknown[] }[] = [];
const updated: { sql: string; params: unknown[] }[] = [];

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });

  if (/^\s*INSERT\b/i.test(sql)) {
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    inserted.push({ table: tableMatch?.[1] ?? 'unknown', sql, params: params ?? [] });
    if (/RETURNING\s+id/i.test(sql)) {
      const id = `gen-${inserted.length.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
      return Promise.resolve({ rows: [{ id } as unknown as T], rowCount: 1 });
    }
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    updated.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }

  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

// ── External backends ─────────────────────────────────────────────────

const tavilySearchMock = vi.fn();
vi.mock('@/lib/research/tavily', () => ({
  tavilySearch: (...args: unknown[]) => tavilySearchMock(...args),
  isTavilyConfigured: () => true,
}));

const perplexityAnswerMock = vi.fn();
vi.mock('@/lib/research/perplexity', () => ({
  perplexityAnswer: (...args: unknown[]) => perplexityAnswerMock(...args),
  isPerplexityConfigured: () => true,
}));

const validateNicheMock = vi.fn();
vi.mock('@/lib/trends/meta-library', () => ({
  validateNiche: (...args: unknown[]) => validateNicheMock(...args),
}));

const aliexpressSearch = vi.fn();
vi.mock('@/lib/suppliers/aliexpress', () => ({
  searchProducts: (...args: unknown[]) => aliexpressSearch(...args),
}));

const cjSearch = vi.fn();
vi.mock('@/lib/suppliers/cj', () => ({
  searchProducts: (...args: unknown[]) => cjSearch(...args),
}));

// ── Anthropic mock ────────────────────────────────────────────────────

interface CannedAnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

const anthropicResponseQueue: CannedAnthropicResponse[] = [];
const trackedMessageMock = vi.fn(async () => {
  const next = anthropicResponseQueue.shift();
  if (!next) {
    throw new Error('No queued Anthropic response — test misconfigured.');
  }
  return next;
});
vi.mock('./anthropic', () => ({
  trackedMessage: (...args: unknown[]) => trackedMessageMock(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function reset() {
  captured.length = 0;
  inserted.length = 0;
  updated.length = 0;
  anthropicResponseQueue.length = 0;
  tavilySearchMock.mockReset();
  perplexityAnswerMock.mockReset();
  validateNicheMock.mockReset();
  aliexpressSearch.mockReset();
  cjSearch.mockReset();
  trackedMessageMock.mockClear();
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const SESSION_ID = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('research-copilot', () => {
  it('persists user + assistant on a plain-text turn', async () => {
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Bienvenue, quel marché vises-tu ?' }],
      stop_reason: 'end_turn',
    });
    const { runResearchTurn } = await import('./research-copilot');
    const events = await drain(runResearchTurn(SESSION_ID, 'salut'));

    const msgs = inserted.filter((i) => i.table === 'dropship_research_messages');
    expect(msgs.length).toBe(2);
    expect(msgs[0]!.params[1]).toBe('user');
    expect(msgs[0]!.params[2]).toBe('salut');
    expect(msgs[1]!.params[1]).toBe('assistant');
    expect(msgs[1]!.params[2]).toBe('Bienvenue, quel marché vises-tu ?');

    const types = events.map((e) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('message');
    expect(types).toContain('done');
  });

  it('web_search routes to Tavily and persists the tool row with results', async () => {
    tavilySearchMock.mockResolvedValue([
      { title: 'Yoga trends 2026', url: 'https://example.com/a', snippet: 'snippet a' },
      { title: 'Best yoga mats', url: 'https://example.com/b', snippet: 'snippet b' },
    ]);

    anthropicResponseQueue.push({
      content: [
        { type: 'tool_use', id: 'tu_w', name: 'web_search', input: { query: 'yoga 2026' } },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'OK.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    await drain(runResearchTurn(SESSION_ID, 'que disent les médias sur le yoga ?'));

    expect(tavilySearchMock).toHaveBeenCalledTimes(1);
    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    expect(toolRows[0]!.params[3]).toBe('web_search');
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.results.length).toBe(2);
    expect(out.results[0].url).toBe('https://example.com/a');
  });

  it('ask_perplexity stores answer + citations', async () => {
    perplexityAnswerMock.mockResolvedValue({
      answer: 'AOV moyen 65 €',
      citations: ['https://shopify.com/blog', 'https://store.com'],
    });

    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_p',
          name: 'ask_perplexity',
          input: { query: 'AOV dropshipping yoga FR' },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Bien.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    await drain(runResearchTurn(SESSION_ID, 'aov ?'));
    const toolRow = inserted.find((i) => i.params[1] === 'tool')!;
    expect(toolRow.params[3]).toBe('ask_perplexity');
    const out = JSON.parse(String(toolRow.params[5]));
    expect(out.answer).toBe('AOV moyen 65 €');
    expect(out.citations).toHaveLength(2);
  });

  it('meta_ads_library tool calls validateNiche and stores the envelope', async () => {
    validateNicheMock.mockResolvedValue({
      saturation: 42,
      verdict: 'caution',
      totalAds: 42,
      topAdvertisers: [{ name: 'BrandA', adCount: 12 }],
      sampleCreatives: [],
      angles: ['pour la maison', 'pour les chats'],
      source: 'claude-fallback',
    });

    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_m',
          name: 'meta_ads_library',
          input: { niche: 'arbre à chat', country: 'FR' },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Compris.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    await drain(runResearchTurn(SESSION_ID, 'check meta'));
    expect(validateNicheMock).toHaveBeenCalledWith('arbre à chat', { country: 'FR' });
    const toolRow = inserted.find((i) => i.params[1] === 'tool')!;
    expect(toolRow.params[3]).toBe('meta_ads_library');
    const out = JSON.parse(String(toolRow.params[5]));
    expect(out.saturation).toBe(42);
    expect(out.verdict).toBe('caution');
  });

  it('aliexpress_search normalises product candidates', async () => {
    aliexpressSearch.mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            product_id: 'ae1',
            product_title: 'Tapis yoga premium',
            product_main_image_url: 'https://img/1.jpg',
            product_url: 'https://ae/1',
            sale_price: '12.50',
            original_price: '20.00',
            discount: '', shop_id: '', shop_url: '',
            category_id: '', category_name: '',
            evaluate_rate: '95%', thirty_days_sold_count: '1200',
          },
          {
            product_id: 'ae2',
            product_title: 'Tapis basique',
            product_main_image_url: 'https://img/2.jpg',
            product_url: 'https://ae/2',
            sale_price: '8.00',
            original_price: '10.00',
            discount: '', shop_id: '', shop_url: '',
            category_id: '', category_name: '',
            evaluate_rate: '88%', thirty_days_sold_count: '500',
          },
          {
            product_id: 'ae3',
            product_title: 'Tapis basique 2',
            product_main_image_url: 'https://img/3.jpg',
            product_url: 'https://ae/3',
            sale_price: '5.00',
            original_price: '7.00',
            discount: '', shop_id: '', shop_url: '',
            category_id: '', category_name: '',
            evaluate_rate: '70%', thirty_days_sold_count: '200',
          },
        ],
        current_page_no: 1, current_record_count: 3, total_record_count: 3,
      },
    });

    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_a',
          name: 'aliexpress_search',
          input: { query: 'tapis yoga', limit: 3 },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Voici.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    await drain(runResearchTurn(SESSION_ID, 'trouve des tapis'));
    expect(aliexpressSearch).toHaveBeenCalledTimes(1);
    const toolRow = inserted.find((i) => i.params[1] === 'tool')!;
    expect(toolRow.params[3]).toBe('aliexpress_search');
    const out = JSON.parse(String(toolRow.params[5]));
    expect(out.candidates).toHaveLength(3);
    expect(out.candidates[0].supplier).toBe('aliexpress');
    expect(out.candidates[0].cost_cents).toBe(1250);
  });

  it('cj_search returns [] without throwing when CJ key is missing', async () => {
    cjSearch.mockResolvedValue({
      success: false,
      error: 'CJ credentials not configured',
    });

    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_c',
          name: 'cj_search',
          input: { query: 'tapis yoga' },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'CJ indispo, je continue.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    const events = await drain(runResearchTurn(SESSION_ID, 'check cj'));
    const toolRow = inserted.find((i) => i.params[1] === 'tool')!;
    const out = JSON.parse(String(toolRow.params[5]));
    expect(out.candidates).toEqual([]);
    expect(out.error).toMatch(/credentials/);
    // No `error` stream event — failures are surfaced as is_error tool results.
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('shortlist_niche emits a `shortlist` stream event', async () => {
    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_s',
          name: 'shortlist_niche',
          input: {
            niche: 'arbre à chat premium',
            rationale: 'Saturation modérée, marges fortes sur AE, AOV 90 EUR.',
            saturation: 32,
            estimated_aov_eur: 90,
            suggested_store_name: 'Felis',
            target_audience: 'Propriétaires de chats CSP+, 25-45 ans',
          },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Voici ma reco.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    const events = await drain(runResearchTurn(SESSION_ID, 'reco'));
    const shortlistEv = events.find((e) => e.type === 'shortlist');
    expect(shortlistEv).toBeDefined();
    const data = shortlistEv!.data as { niche: string; suggested_store_name: string };
    expect(data.niche).toBe('arbre à chat premium');
    expect(data.suggested_store_name).toBe('Felis');
  });

  it('captures Zod-invalid tool input as a tool error row, conversation continues', async () => {
    anthropicResponseQueue.push({
      content: [
        {
          type: 'tool_use',
          id: 'tu_bad',
          name: 'meta_ads_library',
          // missing `niche` (required).
          input: { country: 'FR' },
        },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Bad input, sorry.' }],
      stop_reason: 'end_turn',
    });

    const { runResearchTurn } = await import('./research-copilot');
    const events = await drain(runResearchTurn(SESSION_ID, 'meta'));
    const toolRow = inserted.find((i) => i.params[1] === 'tool')!;
    const out = JSON.parse(String(toolRow.params[5]));
    expect(out.error).toBeTruthy();
    expect(validateNicheMock).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('createResearchSession inserts a row and returns its UUID', async () => {
    const { createResearchSession } = await import('./research-copilot');
    const id = await createResearchSession('AOV cat trees');
    expect(id).toBeTruthy();
    const inserts = inserted.filter((i) => i.table === 'dropship_research_sessions');
    expect(inserts.length).toBe(1);
    expect(inserts[0]!.params[0]).toBe('AOV cat trees');
  });
});
