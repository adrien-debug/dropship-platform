/**
 * Vitest coverage for the per-store Copilote hub router.
 *
 * Strategy:
 *   - Mock @/lib/db with an in-memory query capture (same pattern as
 *     curation-copilot.test.ts) so we can assert on the unified table writes.
 *   - Mock the three legacy copilote `__internals`: only `TOOLS`,
 *     `buildSystemPrompt`, `executeTool` are needed by the router. We
 *     provide spies that mark which executor was hit.
 *   - Mock `./anthropic.trackedMessage` with a programmable queue.
 *   - Mock `./dev-copilot.executeDevTool` and `./asset-regenerator` so we
 *     can assert routing without actually running shell commands or
 *     hitting ComfyUI.
 *
 * Coverage:
 *   1. Unknown mode is rejected with an error event.
 *   2. mode=research dispatches to the research executor.
 *   3. mode=curation dispatches to the curation executor.
 *   4. mode=ads dispatches to the ads executor.
 *   5. mode=medias dispatches to its inline executor.
 *   6. mode=dev dispatches to dev-copilot and forwards autoPushConfirmed.
 *   7. Persists user + assistant + tool rows to dropship_copilot_messages.
 *   8. createCopilotSession inserts into the unified sessions table.
 *   9. confirm_required event is yielded when dev mode flags it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock ─────────────────────────────────────────────────────────────

interface CapturedQuery { sql: string; params: unknown[] }
const captured: CapturedQuery[] = [];
const rowsBySubstring: { pattern: string; rows: unknown[] }[] = [];
const inserted: { table: string; sql: string; params: unknown[] }[] = [];
const updated: { sql: string; params: unknown[] }[] = [];

function setRows(pattern: string, rows: unknown[]) {
  rowsBySubstring.push({ pattern, rows });
}

function dbQuery<T = unknown>(sql: string, params?: unknown[]) {
  captured.push({ sql, params: params ?? [] });
  if (/^\s*INSERT\b/i.test(sql)) {
    const table = sql.match(/INSERT INTO\s+(\w+)/i)?.[1] ?? 'unknown';
    inserted.push({ table, sql, params: params ?? [] });
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

// ── Underlying copilote internals ───────────────────────────────────────

type ExecResult = { output: unknown; summary: string; confirm_required?: boolean };
const researchExec = vi.fn<(...a: unknown[]) => Promise<ExecResult>>(
  async () => ({ output: { ok: 'research' }, summary: 'research-ok' }),
);
const curationExec = vi.fn<(...a: unknown[]) => Promise<ExecResult>>(
  async () => ({ output: { ok: 'curation' }, summary: 'curation-ok' }),
);
const adsExec = vi.fn<(...a: unknown[]) => Promise<ExecResult>>(
  async () => ({ output: { ok: 'ads' }, summary: 'ads-ok' }),
);

vi.mock('./research-copilot', () => ({
  __internals: {
    TOOLS: [{ name: 'web_search', description: '', input_schema: { type: 'object', properties: {} } }],
    buildSystemPrompt: () => 'research-system',
    executeTool: researchExec,
  },
  buildTemporalContext: () => '=== Temporal context (test) ===\nToday: test\n=== End temporal context ===',
  RESEARCH_MODEL: 'claude-opus-4-7',
}));

vi.mock('./curation-copilot', () => ({
  __internals: {
    TOOLS: [{ name: 'search_products', description: '', input_schema: { type: 'object', properties: {} } }],
    buildSystemPrompt: () => 'curation-system',
    executeTool: curationExec,
  },
}));

vi.mock('./ads-copilot', () => ({
  __internals: {
    TOOLS: [{ name: 'list_variants', description: '', input_schema: { type: 'object', properties: {} } }],
    buildSystemPrompt: () => 'ads-system',
    executeTool: adsExec,
  },
}));

// ── Dev + asset mocks ───────────────────────────────────────────────────

const devExec = vi.fn<(...a: unknown[]) => Promise<ExecResult>>(
  async () => ({ output: { ok: 'dev' }, summary: 'dev-ok' }),
);
let lastDevCtx: unknown = null;
vi.mock('./dev-copilot', () => ({
  DEV_TOOLS: [{ name: 'read_file', description: '', input_schema: { type: 'object', properties: {} } }],
  DEV_MODEL: 'claude-sonnet-4-6',
  DEV_MAX_TOOL_LOOPS: 15,
  DEV_MAX_TOOLS_PER_TURN: 20,
  executeDevTool: (name: string, input: unknown, ctx: unknown) => {
    lastDevCtx = ctx;
    return devExec(name, input, ctx);
  },
  buildDevSystemPrompt: () => 'dev-system',
}));

const regenerateAssetMock = vi.fn<(...a: unknown[]) => Promise<{ runId: string; url: string; warnings: string[] }>>(
  async () => ({ runId: 'run-1', url: 'https://r2/x.png', warnings: [] }),
);
const setRunAsCurrentMock = vi.fn<(...a: unknown[]) => Promise<{ url: string }>>(
  async () => ({ url: 'https://r2/y.png' }),
);
const listRunsForStoreMock = vi.fn<(...a: unknown[]) => Promise<Record<string, unknown[]>>>(
  async () => ({}),
);
vi.mock('./asset-regenerator', () => ({
  regenerateAsset: (...a: unknown[]) => regenerateAssetMock(...a),
  setRunAsCurrent: (...a: unknown[]) => setRunAsCurrentMock(...a),
  listRunsForStore: (...a: unknown[]) => listRunsForStoreMock(...a),
  ASSET_KINDS: ['hero', 'cutout', 'lifestyle-1', 'lifestyle-2', 'lifestyle-3', 'promo'],
}));

// ── Anthropic mock ──────────────────────────────────────────────────────

interface CannedAnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

const anthropicResponseQueue: CannedAnthropicResponse[] = [];
const trackedMessageMock = vi.fn<(...a: unknown[]) => Promise<CannedAnthropicResponse>>(
  async () => {
    const next = anthropicResponseQueue.shift();
    if (!next) throw new Error('No queued Anthropic response — test misconfigured.');
    return next;
  },
);
vi.mock('./anthropic', () => ({
  trackedMessage: (...args: unknown[]) => trackedMessageMock(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function seedStore() {
  setRows('FROM dropship_stores WHERE id = $1', [
    {
      id: STORE_ID,
      slug: 'demo-store',
      name: 'Demo',
      niche: 'yoga',
      mode: 'collection',
      medusa_sales_channel_id: 'sc_1',
      product_count: 0,
    },
  ]);
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

beforeEach(() => {
  captured.length = 0;
  rowsBySubstring.length = 0;
  inserted.length = 0;
  updated.length = 0;
  anthropicResponseQueue.length = 0;
  researchExec.mockClear();
  curationExec.mockClear();
  adsExec.mockClear();
  devExec.mockClear();
  regenerateAssetMock.mockClear();
  setRunAsCurrentMock.mockClear();
  listRunsForStoreMock.mockClear();
  trackedMessageMock.mockClear();
  lastDevCtx = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('copilot-router', () => {
  it('rejects unknown mode with an error event', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    // @ts-expect-error — testing runtime guard
    const events = await drain(runCopilotTurn(STORE_ID, 'sess-x', 'lolmode', 'salut'));
    const errEv = events.find((e) => e.type === 'error');
    expect(errEv).toBeDefined();
    expect((errEv!.data as { message: string }).message).toMatch(/Mode inconnu/);
  });

  it('mode=research dispatches to the research executor', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'web_search', input: { query: 'x' } }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    await drain(runCopilotTurn(STORE_ID, 'sess-r', 'research', 'analyse niche yoga'));
    expect(researchExec).toHaveBeenCalledTimes(1);
    expect(curationExec).not.toHaveBeenCalled();
    expect(adsExec).not.toHaveBeenCalled();
    expect(devExec).not.toHaveBeenCalled();
  });

  it('mode=curation dispatches to the curation executor', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'search_products', input: { query: 'tapis' } }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    await drain(runCopilotTurn(STORE_ID, 'sess-c', 'curation', 'cherche tapis'));
    expect(curationExec).toHaveBeenCalledTimes(1);
  });

  it('mode=ads dispatches to the ads executor', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'list_variants', input: {} }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    await drain(runCopilotTurn(STORE_ID, 'sess-a', 'ads', 'liste mes ads'));
    expect(adsExec).toHaveBeenCalledTimes(1);
  });

  it('mode=medias routes list_assets to the inline executor', async () => {
    seedStore();
    listRunsForStoreMock.mockResolvedValueOnce({
      hero: [{ id: 'r1', asset_kind: 'hero', status: 'success', result_url: 'u', is_current: true, prompt: 'p', error_message: null, created_at: '2026-01-01', completed_at: '2026-01-01' }],
    });
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'list_assets', input: {} }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    const events = await drain(runCopilotTurn(STORE_ID, 'sess-m', 'medias', 'liste assets'));
    expect(listRunsForStoreMock).toHaveBeenCalledTimes(1);
    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult).toBeDefined();
  });

  it('mode=dev dispatches to dev executor and forwards autoPushConfirmed=true', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'read_file', input: { path: 'foo.ts' } }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    await drain(
      runCopilotTurn(STORE_ID, 'sess-d', 'dev', 'lis foo.ts', { autoPushConfirmed: true }),
    );
    expect(devExec).toHaveBeenCalledTimes(1);
    expect(lastDevCtx).toMatchObject({ storeId: STORE_ID, autoPushConfirmed: true });
  });

  it('persists user, assistant and tool rows to dropship_copilot_messages', async () => {
    seedStore();
    anthropicResponseQueue.push({
      content: [
        { type: 'text', text: 'Je cherche…' },
        { type: 'tool_use', id: 'tu1', name: 'search_products', input: { query: 'tapis' } },
      ],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'Voici les résultats.' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    await drain(runCopilotTurn(STORE_ID, 'sess-p', 'curation', 'salut'));

    const msgInserts = inserted.filter((i) => i.table === 'dropship_copilot_messages');
    // user + assistant-text-before-tool + tool + assistant-final = 4 rows
    expect(msgInserts.length).toBe(4);
    const roles = msgInserts.map((i) => i.params[1]);
    expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant']);
  });

  it('createCopilotSession inserts into the unified sessions table', async () => {
    const { createCopilotSession } = await import('./copilot-router');
    const id = await createCopilotSession(STORE_ID, 'dev', 'Lundi matin');
    expect(id).toBeTruthy();
    const sess = inserted.filter((i) => i.table === 'dropship_copilot_sessions');
    expect(sess.length).toBe(1);
    expect(sess[0]!.params).toEqual([STORE_ID, 'dev', 'Lundi matin']);
  });

  it('confirm_required event surfaces when dev executor flags it', async () => {
    seedStore();
    devExec.mockResolvedValueOnce({
      output: { confirm_required: true },
      summary: 'git_push — confirmation requise',
      confirm_required: true,
    });
    anthropicResponseQueue.push({
      content: [{ type: 'tool_use', id: 'tu1', name: 'git_push', input: {} }],
      stop_reason: 'tool_use',
    });
    anthropicResponseQueue.push({
      content: [{ type: 'text', text: 'fini' }],
      stop_reason: 'end_turn',
    });
    const { runCopilotTurn } = await import('./copilot-router');
    const events = await drain(
      runCopilotTurn(STORE_ID, 'sess-conf', 'dev', 'push', { autoPushConfirmed: false }),
    );
    const cr = events.find((e) => e.type === 'confirm_required');
    expect(cr).toBeDefined();
    expect((cr!.data as { tool: string }).tool).toBe('git_push');
  });
});
