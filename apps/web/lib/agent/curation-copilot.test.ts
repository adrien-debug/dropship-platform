/**
 * Vitest coverage for the curation copilot.
 *
 * We mock every external boundary so the suite exercises only the agent's
 * loop logic (history rebuild, tool dispatch, Zod validation, DB writes,
 * mutation semantics):
 *   - @/lib/db           : in-memory query capture with canned rows.
 *   - @/lib/medusa       : spy object with createProductWithChannel, deleteProduct.
 *   - @/lib/suppliers/*  : stubbed search functions.
 *   - ./anthropic        : trackedMessage replaced by a programmable spy that
 *                          returns canned Anthropic responses (text blocks +
 *                          tool_use blocks + stop_reason) per call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];

// Rows registry — tests register canned rows per SQL substring.
const rowsBySubstring: { pattern: string; rows: unknown[] }[] = [];

// Inserted rows from INSERT statements — keyed by table name, useful for
// asserting on the message log without a real DB.
const inserted: { table: string; sql: string; params: unknown[] }[] = [];
const deleted: { sql: string; params: unknown[] }[] = [];
const updated: { sql: string; params: unknown[] }[] = [];

function setRows(pattern: string, rows: unknown[]) {
  rowsBySubstring.push({ pattern, rows });
}

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });

  if (/^\s*INSERT\b/i.test(sql)) {
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    inserted.push({ table: tableMatch?.[1] ?? 'unknown', sql, params: params ?? [] });
    // Common pattern: RETURNING id — fabricate.
    if (/RETURNING\s+id/i.test(sql)) {
      const id = `gen-${inserted.length.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
      return Promise.resolve({ rows: [{ id } as unknown as T], rowCount: 1 });
    }
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*DELETE\b/i.test(sql)) {
    deleted.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    updated.push({ sql, params: params ?? [] });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }

  for (const { pattern, rows } of rowsBySubstring) {
    if (sql.includes(pattern)) {
      return Promise.resolve({ rows: rows as T[], rowCount: rows.length });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

const medusaCreateProductWithChannel = vi.fn();
const medusaDeleteProduct = vi.fn();
const medusaUpdateProduct = vi.fn();
vi.mock('@/lib/medusa', () => ({
  medusa: {
    createProductWithChannel: (...args: unknown[]) => medusaCreateProductWithChannel(...args),
    deleteProduct: (...args: unknown[]) => medusaDeleteProduct(...args),
    updateProduct: (...args: unknown[]) => medusaUpdateProduct(...args),
  },
}));

const aliexpressSearch = vi.fn();
vi.mock('@/lib/suppliers/aliexpress', () => ({
  searchProducts: (...args: unknown[]) => aliexpressSearch(...args),
}));

const cjSearch = vi.fn();
vi.mock('@/lib/suppliers/cj', () => ({
  searchProducts: (...args: unknown[]) => cjSearch(...args),
}));

// Programmable trackedMessage. Each test sets a queue of canned responses
// that the curation loop will consume in order.
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

// Helpers
function reset() {
  captured.length = 0;
  rowsBySubstring.length = 0;
  inserted.length = 0;
  deleted.length = 0;
  updated.length = 0;
  anthropicResponseQueue.length = 0;
  medusaCreateProductWithChannel.mockReset();
  medusaDeleteProduct.mockReset();
  medusaUpdateProduct.mockReset();
  aliexpressSearch.mockReset();
  cjSearch.mockReset();
  trackedMessageMock.mockClear();
}

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function seedStore(overrides: Partial<{ name: string; niche: string; mode: string; medusa_sales_channel_id: string; product_count: number }> = {}) {
  setRows('FROM dropship_stores WHERE id = $1 LIMIT 1', [
    {
      id: STORE_ID,
      name: overrides.name ?? 'Test Store',
      niche: overrides.niche ?? 'yoga',
      mode: overrides.mode ?? 'collection',
      medusa_sales_channel_id: overrides.medusa_sales_channel_id ?? 'sc_test',
      product_count: overrides.product_count ?? 0,
    },
  ]);
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

beforeEach(() => {
  reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('curation-copilot', () => {
  it('inserts user + assistant messages when Claude returns plain text', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Bonjour, que veux-tu faire ?' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    const events = await drain(runCurationTurn(STORE_ID, 'sess-1', 'Salut'));

    const insertsMsg = inserted.filter((i) => i.table === 'dropship_curation_messages');
    expect(insertsMsg.length).toBe(2);
    expect(insertsMsg[0]!.params[1]).toBe('user');
    expect(insertsMsg[0]!.params[2]).toBe('Salut');
    expect(insertsMsg[1]!.params[1]).toBe('assistant');
    expect(insertsMsg[1]!.params[2]).toBe('Bonjour, que veux-tu faire ?');

    const types = events.map((e) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('message');
    expect(types).toContain('done');
  });

  it('executes search_products and inserts a tool row with rows', async () => {
    seedStore();
    aliexpressSearch.mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            product_id: 'ae123',
            product_title: 'Tapis yoga premium',
            product_main_image_url: 'https://img/1.jpg',
            sale_price: '12.50',
            original_price: '20.00',
            discount: '',
            shop_id: '', shop_url: '', product_url: 'https://ae/1',
            category_id: '', category_name: '',
            evaluate_rate: '95%',
            thirty_days_sold_count: '1200',
          },
        ],
        current_page_no: 1, current_record_count: 1, total_record_count: 1,
      },
    });
    cjSearch.mockResolvedValue({ success: true, data: { list: [], pageNum: 1, pageSize: 20, total: 0 } });

    anthropicResponseQueue.push({
      content: [
        { type: 'text', text: 'Je cherche…' },
        { type: 'tool_use', id: 'tu_1', name: 'search_products', input: { query: 'tapis yoga', limit: 5 } },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Voici un candidat.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    const events = await drain(runCurationTurn(STORE_ID, 'sess-2', 'Trouve des tapis'));

    expect(aliexpressSearch).toHaveBeenCalledTimes(1);
    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    expect(toolRows[0]!.params[3]).toBe('search_products');
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.candidates?.length).toBe(1);
    expect(out.candidates[0].supplier).toBe('aliexpress');

    const toolCallEvents = events.filter((e) => e.type === 'tool_call');
    const toolResultEvents = events.filter((e) => e.type === 'tool_result');
    expect(toolCallEvents.length).toBe(1);
    expect(toolResultEvents.length).toBe(1);
  });

  it('list_current_products returns DB rows for the store', async () => {
    seedStore();
    setRows('FROM dropship_store_products', [
      {
        id: 'p1', supplier: 'aliexpress',
        enriched_title: 'Tapis', enriched_description: 'Desc',
        price_cents: 2999, cost_cents: 1000,
        image_url: 'img', medusa_product_id: 'prod_m1',
      },
    ]);

    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu_l', name: 'list_current_products', input: {} }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: '1 produit.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    await drain(runCurationTurn(STORE_ID, 'sess-3', 'Liste'));
    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.products.length).toBe(1);
    expect(out.products[0].product_id).toBe('p1');
    expect(out.products[0].margin_cents).toBe(1999);
  });

  it('add_product calls Medusa and inserts dropship_store_products row', async () => {
    seedStore();
    aliexpressSearch.mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            product_id: 'ae-add',
            product_title: 'Bloc liège',
            product_main_image_url: 'https://img/b.jpg',
            sale_price: '8.00', original_price: '10.00',
            discount: '', shop_id: '', shop_url: '',
            product_url: 'https://ae/x', category_id: '', category_name: '',
            evaluate_rate: '90%', thirty_days_sold_count: '500',
          },
        ],
        current_page_no: 1, current_record_count: 1, total_record_count: 1,
      },
    });
    medusaCreateProductWithChannel.mockResolvedValue({ id: 'prod_new', handle: 'h' });

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_a', name: 'add_product',
        input: { supplier: 'aliexpress', supplier_product_id: 'ae-add' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Ajouté.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    await drain(runCurationTurn(STORE_ID, 'sess-4', 'Ajoute ae-add'));
    expect(medusaCreateProductWithChannel).toHaveBeenCalledTimes(1);
    const productInserts = inserted.filter(
      (i) => i.table === 'dropship_store_products' && /INSERT INTO dropship_store_products/i.test(i.sql),
    );
    expect(productInserts.length).toBe(1);
    // params[2] = supplier; params[3] = external_id
    expect(productInserts[0]!.params[2]).toBe('aliexpress');
    expect(productInserts[0]!.params[3]).toBe('ae-add');
  });

  it('remove_product calls Medusa deleteProduct and deletes the DB row', async () => {
    seedStore();
    setRows('SELECT id, medusa_product_id, enriched_title FROM dropship_store_products', [
      { id: '22222222-2222-4222-8222-222222222222', medusa_product_id: 'prod_rm', enriched_title: 'Old' },
    ]);

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_r', name: 'remove_product',
        input: { product_id: '22222222-2222-4222-8222-222222222222' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Supprimé.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    await drain(runCurationTurn(STORE_ID, 'sess-5', 'Supprime'));
    expect(medusaDeleteProduct).toHaveBeenCalledWith('prod_rm');
    expect(deleted.some((d) => /FROM dropship_store_products WHERE id =/i.test(d.sql) || /DELETE FROM dropship_store_products/i.test(d.sql))).toBe(true);
  });

  it('update_product_price updates DB only — no Medusa call', async () => {
    seedStore();
    setRows('SELECT id, enriched_title, price_cents, cost_cents', [
      {
        id: '33333333-3333-4333-8333-333333333333',
        enriched_title: 'X', price_cents: 1999, cost_cents: 800,
      },
    ]);

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_u', name: 'update_product_price',
        input: { product_id: '33333333-3333-4333-8333-333333333333', price_cents: 3499 },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Mis à jour.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    await drain(runCurationTurn(STORE_ID, 'sess-6', 'Re-price'));
    expect(medusaCreateProductWithChannel).not.toHaveBeenCalled();
    expect(medusaUpdateProduct).not.toHaveBeenCalled();
    expect(medusaDeleteProduct).not.toHaveBeenCalled();
    expect(
      updated.some((u) => /SET price_cents = \$1/.test(u.sql)),
    ).toBe(true);
  });

  it('tool error is recorded in the tool row and the conversation continues', async () => {
    seedStore();
    // Force an aliexpress search rejection so add_product throws "introuvable".
    aliexpressSearch.mockResolvedValue({ success: true, data: { products: [], current_page_no: 1, current_record_count: 0, total_record_count: 0 } });

    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_err', name: 'add_product',
        input: { supplier: 'aliexpress', supplier_product_id: 'doesnotexist' },
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Je n’ai pas pu, désolé.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    const events = await drain(runCurationTurn(STORE_ID, 'sess-7', 'Ajoute doesnotexist'));
    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.error).toMatch(/introuvable/);
    // The loop continued and reached end_turn.
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(events.some((e) => e.type === 'message')).toBe(true);
  });

  it('Zod-invalid tool input is captured as an error row, model is given the chance to retry', async () => {
    seedStore();
    // First call: missing required `supplier_product_id`. Second call: end_turn.
    anthropicResponseQueue.push({
      content: [{
        type: 'tool_use', id: 'tu_bad', name: 'add_product',
        input: { supplier: 'aliexpress' }, // missing supplier_product_id
      }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Désolé, schéma invalide.' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    await drain(runCurationTurn(STORE_ID, 'sess-8', 'Ajoute mal formé'));
    const toolRows = inserted.filter((i) => i.params[1] === 'tool');
    expect(toolRows.length).toBe(1);
    const out = JSON.parse(String(toolRows[0]!.params[5]));
    expect(out.error).toBeTruthy();
    // The Medusa side must not have been called.
    expect(medusaCreateProductWithChannel).not.toHaveBeenCalled();
  });

  it('createCurationSession inserts a row into dropship_curation_sessions', async () => {
    seedStore();
    const { createCurationSession } = await import('./curation-copilot');
    const id = await createCurationSession(STORE_ID);
    expect(id).toBeTruthy();
    const inserts = inserted.filter((i) => i.table === 'dropship_curation_sessions');
    expect(inserts.length).toBe(1);
    expect(inserts[0]!.params[0]).toBe(STORE_ID);
  });

  it('emits an error event when the store is missing', async () => {
    // No seedStore — the SELECT returns no rows, loadStore returns null.
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'irrelevant' }],
      stop_reason: 'end_turn',
    });

    const { runCurationTurn } = await import('./curation-copilot');
    const events = await drain(runCurationTurn(STORE_ID, 'sess-9', 'hello'));
    // Should not have called Anthropic — the loop bails out before.
    expect(trackedMessageMock).not.toHaveBeenCalled();
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    // Drain consumed the queued response — pop it back so afterEach doesn't
    // complain when the next test runs (anthropicResponseQueue is reset in
    // beforeEach anyway, just being explicit).
    anthropicResponseQueue.length = 0;
  });
});
