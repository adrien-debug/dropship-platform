/**
 * Tests for POST /api/cockpit-chat/chats
 *
 * Mocks @/lib/db so no real Postgres is needed.
 * Tests the happy path (returns { id }) and the misconfigured env path (500).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── DB mock ────────────────────────────────────────────────────────────────

const insertedRows: { sql: string; params: unknown[] }[] = [];

function dbQuery(sql: string, params?: unknown[]) {
  if (/^\s*INSERT\b/i.test(sql)) {
    insertedRows.push({ sql, params: params ?? [] });
  }
  return Promise.resolve({ rows: [], rowCount: 1 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

import { POST } from './route';

beforeEach(() => {
  insertedRows.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.ADMIN_USERNAME;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/cockpit-chat/chats', () => {
  it('returns { id } with a non-empty string when ADMIN_USERNAME is set', async () => {
    process.env.ADMIN_USERNAME = 'admin';
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('inserts a row into dropship_cockpit_chats on success', async () => {
    process.env.ADMIN_USERNAME = 'admin';
    const res = await POST();
    const body = await res.json() as { id: string };

    const insert = insertedRows.find((q) => q.sql.includes('dropship_cockpit_chats'));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe(body.id);
    expect(insert!.params[1]).toBe('admin');
  });

  it('returns 500 when ADMIN_USERNAME is not configured', async () => {
    process.env.ADMIN_USERNAME = '';
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/ADMIN_USERNAME/);
  });
});
