/**
 * Unit coverage for the P1.3 order anomaly watcher.
 *
 * Scope: stub `getDb` and the Medusa client so the test exercises only the
 * scanner's SQL shape + aggregation logic. We assert:
 *   1. The stranded query targets the required conditions (status='sent',
 *      paid_at IS NULL, dry_run = false, age > 15 days).
 *   2. The result payload mirrors the rows + computed ages.
 *   3. The Medusa-down path still surfaces SQL-only anomalies and reports a
 *      warning instead of throwing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

const captured: CapturedQuery[] = [];

// Per-SQL-pattern row provider. Each test installs its own canned rows; we
// match on a substring of the SQL because the scanner's queries are unique
// enough to pick apart without a brittle exact-match.
type RowSet = unknown[];
const rowsByPattern: { pattern: string; rows: RowSet }[] = [];

function setRows(pattern: string, rows: RowSet) {
  rowsByPattern.push({ pattern, rows });
}

function dbQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  captured.push({ sql, params: params ?? [] });
  for (const { pattern, rows } of rowsByPattern) {
    if (sql.includes(pattern)) {
      return Promise.resolve({ rows: rows as T[], rowCount: rows.length });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
}));

const getOrdersMock = vi.fn();
vi.mock('@/lib/medusa', () => ({
  medusa: {
    getOrders: (...args: unknown[]) => getOrdersMock(...args),
  },
}));

beforeEach(() => {
  captured.length = 0;
  rowsByPattern.length = 0;
  getOrdersMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('runAnomalyWatch — stranded query', () => {
  it('targets sent + unpaid + live forwards older than 15 days', async () => {
    setRows('paid_at IS NULL', [
      {
        medusa_order_id: 'ord_01',
        ae_order_id: 'ae_99',
        // 17 days ago — past the 15-day threshold.
        created_at: new Date(Date.now() - 17 * 24 * 3_600_000).toISOString(),
      },
    ]);
    getOrdersMock.mockResolvedValue({ orders: [], count: 0 });

    const { runAnomalyWatch } = await import('./anomaly-watch');
    const result = await runAnomalyWatch();

    // SQL shape: every required guard must appear in the stranded query.
    const strandedQuery = captured.find((q) => q.sql.includes('paid_at IS NULL'));
    expect(strandedQuery).toBeDefined();
    expect(strandedQuery!.sql).toMatch(/status\s*=\s*'sent'/);
    expect(strandedQuery!.sql).toMatch(/dry_run\s*=\s*false/);
    expect(strandedQuery!.sql).toMatch(/created_at\s*<\s*now\(\)\s*-\s*interval\s*'15 days'/);

    expect(result.ok).toBe(true);
    expect(result.counts.stranded).toBe(1);
    expect(result.stranded[0].medusa_order_id).toBe('ord_01');
    expect(result.stranded[0].ae_order_id).toBe('ae_99');
    expect(result.stranded[0].age_days).toBeGreaterThanOrEqual(15);
    expect(result.total).toBe(1);
  });

  it('returns total=0 with empty buckets when no anomalies match', async () => {
    getOrdersMock.mockResolvedValue({ orders: [], count: 0 });
    const { runAnomalyWatch } = await import('./anomaly-watch');
    const result = await runAnomalyWatch();
    expect(result.ok).toBe(true);
    expect(result.total).toBe(0);
    expect(result.counts).toEqual({ stranded: 0, stuck: 0, errors: 0 });
    expect(result.stranded).toEqual([]);
    expect(result.stuck).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('still reports SQL-only anomalies when Medusa is unreachable', async () => {
    setRows("status = 'error'", [
      {
        medusa_order_id: 'ord_err_42',
        error_message: 'Missing required address fields: province',
        created_at: new Date(Date.now() - 72 * 3_600_000).toISOString(),
      },
    ]);
    getOrdersMock.mockRejectedValue(new Error('Medusa /admin/orders timeout'));

    const { runAnomalyWatch } = await import('./anomaly-watch');
    const result = await runAnomalyWatch();
    expect(result.ok).toBe(true);
    expect(result.counts.errors).toBe(1);
    expect(result.errors[0].error_message).toMatch(/province/);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/medusa_unreachable/);
  });
});
