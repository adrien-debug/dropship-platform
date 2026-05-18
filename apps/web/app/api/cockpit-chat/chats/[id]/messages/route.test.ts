/**
 * Tests for:
 *   GET  /api/cockpit-chat/chats/[id]/messages  → { messages: ChatMessage[] }
 *   POST /api/cockpit-chat/chats/[id]/messages  → { ok: true }
 *
 * Mocks @/lib/db so no real Postgres is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── DB mock ────────────────────────────────────────────────────────────────

const insertedRows: { sql: string; params: unknown[] }[] = [];
const updatedRows: { sql: string; params: unknown[] }[] = [];
const selectRows: unknown[] = [];

function dbQuery<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
  const p = params ?? [];
  if (/^\s*INSERT\b/i.test(sql)) {
    insertedRows.push({ sql, params: p });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    updatedRows.push({ sql, params: p });
    return Promise.resolve({ rows: [] as T[], rowCount: 1 });
  }
  // SELECT queries — return seeded rows
  return Promise.resolve({ rows: selectRows as T[], rowCount: selectRows.length });
}

vi.mock('@/lib/db', () => ({
  getDb: () => ({ query: dbQuery }),
  getDbRead: () => ({ query: dbQuery }),
}));

import { GET, POST } from './route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/cockpit-chat/chats/${id}/messages`, { method: 'GET' });
}

function makePostRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/cockpit-chat/chats/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insertedRows.length = 0;
  updatedRows.length = 0;
  selectRows.length = 0;
  vi.clearAllMocks();
  process.env.ADMIN_USERNAME = 'admin';
});

afterEach(() => {
  delete process.env.ADMIN_USERNAME;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cockpit-chat/chats/[id]/messages', () => {
  it('returns { messages: [] } when no messages exist for the chat', async () => {
    const res = await GET(makeGetRequest('chat-1'), makeContext('chat-1'));
    expect(res.status).toBe(200);
    const body = await res.json() as { messages: unknown[] };
    expect(body.messages).toEqual([]);
  });

  it('returns mapped messages with createdAt as a number', async () => {
    selectRows.push(
      { id: 'msg-1', role: 'user', content: 'Hello', created_at_ms: '1700000000000' },
      { id: 'msg-2', role: 'assistant', content: 'Hi!', created_at_ms: '1700000001000' },
    );

    const res = await GET(makeGetRequest('chat-2'), makeContext('chat-2'));
    expect(res.status).toBe(200);
    const body = await res.json() as { messages: { id: string; role: string; content: string; createdAt: number }[] };
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1700000000000 });
    expect(body.messages[1].role).toBe('assistant');
  });

  it('returns 500 when ADMIN_USERNAME is not configured', async () => {
    process.env.ADMIN_USERNAME = '';
    const res = await GET(makeGetRequest('chat-x'), makeContext('chat-x'));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/ADMIN_USERNAME/);
  });
});

describe('POST /api/cockpit-chat/chats/[id]/messages', () => {
  it('returns { ok: true } on a valid message payload', async () => {
    const msg = { id: 'msg-ok', role: 'user', content: 'Test', createdAt: 1700000000000 };
    const res = await POST(makePostRequest('chat-3', { message: msg }), makeContext('chat-3'));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('inserts the message and then updates the parent chat', async () => {
    const msg = { id: 'msg-persist', role: 'assistant', content: 'Salut', createdAt: 1700000002000 };
    await POST(makePostRequest('chat-4', { message: msg }), makeContext('chat-4'));

    const insert = insertedRows.find((q) => q.sql.includes('dropship_cockpit_chat_messages'));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe('msg-persist');

    const update = updatedRows.find((q) => q.sql.includes('dropship_cockpit_chats'));
    expect(update).toBeDefined();
    expect(update!.params[0]).toBe('chat-4');
  });

  it('returns 400 when message payload is missing required fields', async () => {
    const res = await POST(
      makePostRequest('chat-5', { message: { id: 'x' } }), // missing role + content
      makeContext('chat-5'),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid message/);
  });

  it('returns 400 when the JSON body is malformed', async () => {
    const req = new NextRequest('http://localhost/api/cockpit-chat/chats/chat-6/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req, makeContext('chat-6'));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid JSON/);
  });

  it('returns 500 when ADMIN_USERNAME is not configured', async () => {
    process.env.ADMIN_USERNAME = '';
    const msg = { id: 'msg-no-auth', role: 'user', content: 'Test', createdAt: 1700000000000 };
    const res = await POST(makePostRequest('chat-7', { message: msg }), makeContext('chat-7'));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/ADMIN_USERNAME/);
  });
});
