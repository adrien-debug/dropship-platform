/**
 * Tests for GET /api/domain-resolve
 *
 * The route strips the port from the host, queries dropship_stores by
 * custom_domain, and returns { slug } or 404. getDbRead is mocked so no
 * real Postgres connection is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock getDbRead — must happen before the module under test is imported.
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();

vi.mock('@/lib/db', () => ({
  getDbRead: () => ({ query: mockQuery }),
  getDb: () => ({ query: mockQuery }),
}));

// Import after mock registration.
import { GET } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(search: string) {
  return new NextRequest(`http://localhost/api/domain-resolve${search}`);
}

beforeEach(() => {
  mockQuery.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/domain-resolve', () => {
  it('returns 400 when host param is missing', async () => {
    const res = await GET(makeReq(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing host');
  });

  it('returns 404 when domain is not in the DB', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(makeReq('?host=unknown.example.com'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });

  it('returns { slug } for a known active store', async () => {
    mockQuery.mockResolvedValue({ rows: [{ slug: 'maison-chic' }] });
    const res = await GET(makeReq('?host=maison-chic.com'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ slug: 'maison-chic' });
  });

  it('strips port from host before DB lookup', async () => {
    mockQuery.mockResolvedValue({ rows: [{ slug: 'test-store' }] });
    const res = await GET(makeReq('?host=maison-chic.com%3A3000'));
    expect(res.status).toBe(200);

    // Verify the query was called with the bare hostname (no port).
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('custom_domain = $1'),
      ['maison-chic.com'],
    );
  });

  it('returns 404 for an inactive store (query returns no rows)', async () => {
    // The SQL WHERE clause already filters status = 'active', so the DB
    // returns an empty result for inactive stores — the route sees rows: [].
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(makeReq('?host=inactive-store.com'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });
});
