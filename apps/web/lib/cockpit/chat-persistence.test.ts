/**
 * Tests for createCockpitChatPersistence (chat-persistence.ts)
 *
 * Strategy: mock @/lib/db with an in-memory query capture so no real
 * Postgres connection is required. Assert SQL shapes and return values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock (must be hoisted before module import) ─────────────────────────

interface CapturedQuery { sql: string; params: unknown[] }
const capturedQueries: CapturedQuery[] = [];
const insertedRows: CapturedQuery[] = [];
const updatedRows: CapturedQuery[] = [];

type MockQueryResult = { rows: unknown[]; rowCount: number };
// Programmatic result overrides keyed by SQL substring.
const resultOverrides: { pattern: string; result: MockQueryResult }[] = [];

function dbQuery<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
  const p = params ?? [];
  capturedQueries.push({ sql, params: p });

  if (/^\s*INSERT\b/i.test(sql)) {
    insertedRows.push({ sql, params: p });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    updatedRows.push({ sql, params: p });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  for (const { pattern, result } of resultOverrides) {
    if (sql.includes(pattern)) {
      return Promise.resolve({ rows: result.rows as T[], rowCount: result.rowCount });
    }
  }
  return Promise.resolve({ rows: [] as T[], rowCount: 0 });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

// ── Import after mock registration ─────────────────────────────────────────

import { createCockpitChatPersistence } from './chat-persistence';

// ── Helpers ────────────────────────────────────────────────────────────────

function seedMessages(rows: unknown[]) {
  resultOverrides.push({ pattern: 'dropship_cockpit_chat_messages', result: { rows, rowCount: rows.length } });
}

beforeEach(() => {
  capturedQueries.length = 0;
  insertedRows.length = 0;
  updatedRows.length = 0;
  resultOverrides.length = 0;
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createCockpitChatPersistence', () => {
  describe('createChat()', () => {
    it('inserts a row into dropship_cockpit_chats and returns a non-empty id', async () => {
      const persistence = createCockpitChatPersistence('admin');
      const id = await persistence.createChat();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('calls INSERT with the generated id and adminUser as params', async () => {
      const persistence = createCockpitChatPersistence('admin-user-1');
      const id = await persistence.createChat();

      const insert = insertedRows.find((q) => q.sql.includes('dropship_cockpit_chats'));
      expect(insert).toBeDefined();
      expect(insert!.params[0]).toBe(id);
      expect(insert!.params[1]).toBe('admin-user-1');
    });

    it('returns different ids on successive calls (UUID-like)', async () => {
      const persistence = createCockpitChatPersistence('admin');
      const id1 = await persistence.createChat();
      const id2 = await persistence.createChat();
      expect(id1).not.toBe(id2);
    });
  });

  describe('loadMessages(chatId)', () => {
    it('returns [] when the query returns no rows (chat absent or wrong admin)', async () => {
      // resultOverrides is empty → dbQuery returns [] by default
      const persistence = createCockpitChatPersistence('admin-a');
      const messages = await persistence.loadMessages('chat-xyz');
      expect(messages).toEqual([]);
    });

    it('returns mapped ChatMessage[] with correct field names', async () => {
      seedMessages([
        { id: 'msg-1', role: 'user', content: 'Bonjour', created_at_ms: '1700000000000' },
        { id: 'msg-2', role: 'assistant', content: 'Salut!', created_at_ms: '1700000001000' },
      ]);

      const persistence = createCockpitChatPersistence('admin');
      const messages = await persistence.loadMessages('chat-abc');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ id: 'msg-1', role: 'user', content: 'Bonjour', createdAt: 1700000000000 });
      expect(messages[1]).toEqual({ id: 'msg-2', role: 'assistant', content: 'Salut!', createdAt: 1700000001000 });
    });

    it('passes admin_user as a query param (RLS-like filter)', async () => {
      const persistence = createCockpitChatPersistence('admin-b');
      await persistence.loadMessages('chat-rls');

      const loadQuery = capturedQueries.find((q) => q.sql.includes('chat_id = $1'));
      expect(loadQuery).toBeDefined();
      expect(loadQuery!.params).toContain('chat-rls');
      expect(loadQuery!.params).toContain('admin-b');
    });

    it('SQL includes WHERE clause that joins on admin_user', async () => {
      const persistence = createCockpitChatPersistence('admin-c');
      await persistence.loadMessages('some-chat');

      const loadQuery = capturedQueries.find((q) =>
        q.sql.includes('admin_user') && q.sql.includes('chat_id'),
      );
      expect(loadQuery).toBeDefined();
    });
  });

  describe('saveMessage(chatId, msg)', () => {
    it('inserts a message row with ON CONFLICT DO NOTHING (idempotent)', async () => {
      const persistence = createCockpitChatPersistence('admin');
      const msg = { id: 'msg-abc', role: 'user' as const, content: 'Hello', createdAt: 1700000000000 };
      await persistence.saveMessage('chat-1', msg);

      const insertQuery = insertedRows.find((q) =>
        q.sql.includes('dropship_cockpit_chat_messages'),
      );
      expect(insertQuery).toBeDefined();
      expect(insertQuery!.sql).toMatch(/ON CONFLICT.*DO NOTHING/i);
    });

    it('passes correct params to the insert query (including adminUser for ownership)', async () => {
      const persistence = createCockpitChatPersistence('admin');
      const msg = { id: 'msg-def', role: 'assistant' as const, content: 'World', createdAt: 1700000002000 };
      await persistence.saveMessage('chat-2', msg);

      const insertQuery = insertedRows.find((q) =>
        q.sql.includes('dropship_cockpit_chat_messages'),
      );
      expect(insertQuery).toBeDefined();
      // $6 is adminUser for the ownership sub-select
      expect(insertQuery!.params).toEqual(['msg-def', 'chat-2', 'assistant', 'World', 1700000002000, 'admin']);
    });

    it('updates the parent chat updated_at after saving a message (with ownership guard)', async () => {
      const persistence = createCockpitChatPersistence('admin');
      const msg = { id: 'msg-upd', role: 'user' as const, content: 'Ping', createdAt: 1700000003000 };
      await persistence.saveMessage('chat-3', msg);

      const updateQuery = updatedRows.find((q) =>
        q.sql.includes('dropship_cockpit_chats') && q.sql.includes('updated_at'),
      );
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[0]).toBe('chat-3');
      // admin_user ownership guard also in the UPDATE
      expect(updateQuery!.params[1]).toBe('admin');
    });
  });
});
