/**
 * Vitest coverage for run_sql read-only enforcement in super-agent.
 *
 * Strategy:
 *   - `assertReadOnlySql` is a pure exported function — tested directly with
 *     no mocking needed.
 *   - `execRunSql` is exported and exercised with a mocked getDb pool so we
 *     can confirm the DB is never called when the query is rejected, and IS
 *     called when a valid SELECT is issued in read mode.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock heavy dependencies so the module can be imported ─────────────────

// getDb / pg pool — we don't want a real Postgres connection in unit tests.
const mockQuery = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: mockQuery }),
  getDbRead: () => ({ query: mockQuery }),
}));

// Kimi client — not under test here.
vi.mock('./kimi', () => ({
  trackedKimiMessage: vi.fn(),
}));

// dev-copilot — not under test here.
vi.mock('./dev-copilot', () => ({
  executeDevTool: vi.fn(),
  DEV_TOOLS: [],
}));

// asset-regenerator — not under test here.
vi.mock('./asset-regenerator', () => ({
  regenerateAsset: vi.fn(),
  ASSET_KINDS: [],
}));

// comfy-client — not under test here.
vi.mock('./comfy-client', () => ({
  isComfyConfigured: vi.fn(() => false),
  getDeploymentIds: vi.fn(() => []),
}));

// fal-client — not under test here.
vi.mock('./fal-client', () => ({
  isFalConfigured: vi.fn(() => false),
}));

// medusa — not under test here.
vi.mock('@/lib/medusa', () => ({
  getMedusaBaseUrl: vi.fn(() => 'http://medusa.test'),
  getMedusaAuthMode: vi.fn(() => 'jwt'),
  medusa: {},
}));

import { assertReadOnlySql, execRunSql } from './super-agent';

// ── assertReadOnlySql — unit tests (pure function, no I/O) ────────────────

describe('assertReadOnlySql — allowed queries', () => {
  it('allows plain SELECT 1', () => {
    expect(assertReadOnlySql('SELECT 1')).toBeNull();
  });

  it('allows SELECT with WHERE and params placeholder', () => {
    expect(assertReadOnlySql('SELECT id, name FROM dropship_stores WHERE id = $1')).toBeNull();
  });

  it('allows SELECT with trailing semicolon', () => {
    expect(assertReadOnlySql('SELECT 1;')).toBeNull();
  });

  it('allows read-only WITH … SELECT CTE (leading comments + whitespace)', () => {
    expect(
      assertReadOnlySql('  -- un commentaire\n WITH x AS (SELECT 1) SELECT * FROM x'),
    ).toBeNull();
  });

  it('allows WITH … SELECT with block comment', () => {
    expect(
      assertReadOnlySql('/* bloc */ WITH cte AS (SELECT id FROM dropship_stores) SELECT * FROM cte'),
    ).toBeNull();
  });

  it('does not false-positive on column name "updated_at"', () => {
    expect(assertReadOnlySql('SELECT updated_at FROM dropship_stores')).toBeNull();
  });

  it('does not false-positive on column alias containing a keyword', () => {
    expect(assertReadOnlySql('SELECT count(*) AS total_count FROM dropship_stores')).toBeNull();
  });

  // AC1: replace() is a standard Postgres read function — must NOT be blocked.
  it('allows SELECT with replace() string function (AC1)', () => {
    expect(
      assertReadOnlySql("SELECT replace(description, 'a', 'b') FROM dropship_stores"),
    ).toBeNull();
  });
});

describe('assertReadOnlySql — rejected queries', () => {
  it('rejects DELETE FROM dropship_stores', () => {
    const result = assertReadOnlySql('DELETE FROM dropship_stores');
    expect(result).not.toBeNull();
    expect(result).toMatch(/DELETE/i);
  });

  it('rejects UPDATE statement', () => {
    const result = assertReadOnlySql('UPDATE dropship_stores SET name = $1 WHERE id = $2');
    expect(result).not.toBeNull();
    expect(result).toMatch(/UPDATE/i);
  });

  it('rejects DROP TABLE', () => {
    const result = assertReadOnlySql('DROP TABLE foo');
    expect(result).not.toBeNull();
    expect(result).toMatch(/DROP/i);
  });

  it('rejects INSERT', () => {
    const result = assertReadOnlySql("INSERT INTO dropship_stores (name) VALUES ('x')");
    expect(result).not.toBeNull();
    expect(result).toMatch(/INSERT/i);
  });

  it('rejects TRUNCATE', () => {
    const result = assertReadOnlySql('TRUNCATE dropship_stores');
    expect(result).not.toBeNull();
    expect(result).toMatch(/TRUNCATE/i);
  });

  it('rejects ALTER TABLE', () => {
    const result = assertReadOnlySql('ALTER TABLE foo ADD COLUMN bar text');
    expect(result).not.toBeNull();
    expect(result).toMatch(/ALTER/i);
  });

  it('rejects multiple statements separated by semicolon', () => {
    const result = assertReadOnlySql('SELECT 1; DROP TABLE foo');
    expect(result).not.toBeNull();
    expect(result).toMatch(/plusieurs instructions/i);
  });

  it('rejects WITH CTE containing DELETE … RETURNING', () => {
    const result = assertReadOnlySql(
      'WITH d AS (DELETE FROM dropship_stores RETURNING id) SELECT * FROM d',
    );
    expect(result).not.toBeNull();
    expect(result).toMatch(/DELETE/i);
  });

  it('rejects non-SELECT/WITH first keyword (raw UPDATE)', () => {
    const result = assertReadOnlySql('UPDATE foo SET x = 1');
    expect(result).not.toBeNull();
  });

  it('rejects GRANT', () => {
    const result = assertReadOnlySql('GRANT ALL ON TABLE foo TO bar');
    expect(result).not.toBeNull();
    expect(result).toMatch(/GRANT/i);
  });

  it('rejects REVOKE', () => {
    const result = assertReadOnlySql('REVOKE ALL ON TABLE foo FROM bar');
    expect(result).not.toBeNull();
    expect(result).toMatch(/REVOKE/i);
  });

  it('rejects SELECT 1; DELETE FROM x (multi-statement injection)', () => {
    const result = assertReadOnlySql('SELECT 1; DELETE FROM x');
    expect(result).not.toBeNull();
  });

  it('rejects WITH d AS (DELETE .. RETURNING) SELECT (data-modifying CTE)', () => {
    const result = assertReadOnlySql(
      'WITH d AS (DELETE FROM x RETURNING id) SELECT * FROM d',
    );
    expect(result).not.toBeNull();
  });
});

// ── execRunSql integration — real function calls with mocked DB pool ──────
//
// AC4: these tests actually invoke execRunSql (not just assertReadOnlySql)
// so we can confirm: (a) destructive read → throws AND db not called,
// (b) valid SELECT read → db IS called and rows are returned.

describe('execRunSql integration — mocked DB pool', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('(a) throws and does NOT call db.query for DELETE in mode=read', async () => {
    // db should never be reached — the guard throws before getDb() is called.
    await expect(
      execRunSql({ query: 'DELETE FROM dropship_stores', mode: 'read' }, {}),
    ).rejects.toThrow(/DELETE/i);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('(b) calls db.query and returns rows for SELECT 1 in mode=read', async () => {
    const fakeRows = [{ '?column?': 1 }];
    mockQuery.mockResolvedValueOnce({ rows: fakeRows });

    const result = await execRunSql({ query: 'SELECT 1', mode: 'read' }, {});

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(result.output).toEqual({ rows: fakeRows, count: 1 });
  });
});
