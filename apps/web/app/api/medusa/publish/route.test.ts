import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { queryMock, getDbMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const getDbMock = vi.fn(() => ({ query: queryMock }));
  return { queryMock, getDbMock };
});

vi.mock('@/lib/db', () => ({
  getDb: getDbMock,
}));

import { medusa } from '@/lib/medusa';
import { GET, POST } from './route';

function jsonPost(body: unknown) {
  return new NextRequest('http://localhost/api/medusa/publish', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/medusa/publish', () => {
  let checkConfigSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryMock.mockReset();
    getDbMock.mockClear();
    checkConfigSpy = vi.spyOn(medusa, 'checkConfig');
    checkConfigSpy.mockReturnValue({ ok: true, message: 'ok' });
  });

  afterEach(() => {
    checkConfigSpy.mockRestore();
  });

  it('returns 400 when productIds is empty', async () => {
    const res = await POST(jsonPost({ productIds: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when Medusa is not configured', async () => {
    checkConfigSpy.mockReturnValue({ ok: false, message: 'Missing token' });
    const res = await POST(jsonPost({ productIds: ['550e8400-e29b-41d4-a716-446655440000'] }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing token');
  });
});

describe('GET /api/medusa/publish', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getDbMock.mockClear();
    getDbMock.mockImplementation(() => ({ query: queryMock }));
  });

  it('returns stats from two count queries', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ count: '11' }] });
    const req = new NextRequest('http://localhost/api/medusa/publish');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      stats: { publishedToMedusa: number; notPublished: number };
    };
    expect(body.success).toBe(true);
    expect(body.stats.publishedToMedusa).toBe(4);
    expect(body.stats.notPublished).toBe(11);
  });

  it('returns 404 when productId not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const req = new NextRequest(
      'http://localhost/api/medusa/publish?productId=550e8400-e29b-41d4-a716-446655440000',
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns product when productId exists', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Item',
          medusa_product_id: 'med-1',
          published_to_medusa_at: '2024-01-01',
          status: 'published',
        },
      ],
    });
    const req = new NextRequest(
      'http://localhost/api/medusa/publish?productId=550e8400-e29b-41d4-a716-446655440000',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      product: { title: string; isPublishedToMedusa: boolean };
    };
    expect(body.product.title).toBe('Item');
    expect(body.product.isPublishedToMedusa).toBe(true);
  });

  it('returns 503 when DATABASE_URL is missing', async () => {
    getDbMock.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL manquant : défini sur Vercel.");
    });
    const req = new NextRequest('http://localhost/api/medusa/publish');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
