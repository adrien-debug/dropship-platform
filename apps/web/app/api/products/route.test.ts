import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { queryMock, getDbMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const getDbMock = vi.fn(() => ({ query: queryMock }));
  return { queryMock, getDbMock };
});

vi.mock('@/lib/db', () => ({
  getDb: getDbMock,
}));

import { GET } from './route';

const sampleRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Test',
  description: null,
  price_cents: 999,
  cost_cents: 500,
  category: 'c',
  supplier: 'cj',
  external_id: 'ext',
  image_url: null,
  status: 'draft',
  medusa_product_id: null,
  published_to_medusa_at: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-02',
};

describe('GET /api/products', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getDbMock.mockClear();
    getDbMock.mockImplementation(() => ({ query: queryMock }));
  });

  it('returns 400 for invalid status', async () => {
    const req = new NextRequest('http://localhost/api/products?status=nope');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('lists products with status=all', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow] });
    const req = new NextRequest('http://localhost/api/products?status=all&limit=10');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; products: typeof sampleRow[] };
    expect(body.success).toBe(true);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].title).toBe('Test');
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('FROM dropship_products'),
      expect.arrayContaining([10]),
    );
  });

  it('filters by draft', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const req = new NextRequest('http://localhost/api/products?status=draft');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE status = $1'),
      ['draft', 50],
    );
  });

  it('returns 503 when DATABASE_URL missing', async () => {
    getDbMock.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL manquant : défini sur Vercel.");
    });
    const req = new NextRequest('http://localhost/api/products');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
