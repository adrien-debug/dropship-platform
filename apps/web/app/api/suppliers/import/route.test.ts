import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({
      rows: [{ id: 'uuid-1', title: 'Imported', price_cents: 1000, supplier: 'cj', external_id: 'p1' }],
    }),
  })),
}));

import type { AliExpressProduct } from '@/lib/suppliers/aliexpress';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import type { CJProduct } from '@/lib/suppliers/cj';
import * as cj from '@/lib/suppliers/cj';
import { POST } from './route';

const mockCjProduct: CJProduct = {
  productNameEn: 'Case',
  sellPrice: 12.5,
  pid: 'pid-1',
  productImage: 'https://img',
  sellUrl: 'https://cj',
  categoryName: 'Accessories',
  productWeight: '100',
  categoryId: 'cat-1',
  sourceFrom: 0,
};

const mockAeProduct: AliExpressProduct = {
  product_title: 'Gadget',
  sale_price: '9.99',
  original_price: '12',
  product_id: 'ae-1',
  product_main_image_url: 'https://ae/img',
  product_url: 'https://ae/p',
  category_name: 'Electronics',
  category_id: 'c1',
  discount: '0',
  shop_id: 's1',
  shop_url: 'https://shop',
  evaluate_rate: '98%',
  thirty_days_sold_count: '100',
};

function jsonPost(body: unknown) {
  return new NextRequest('http://localhost/api/suppliers/import', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/suppliers/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 on Zod validation error', async () => {
    const res = await POST(jsonPost({ source: 'cj', keywords: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: 'Invalid parameters' });
  });

  it('returns 400 when source is invalid', async () => {
    const res = await POST(jsonPost({ source: 'other', keywords: 'x' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 with zero results when supplier returns empty list', async () => {
    vi.spyOn(cj, 'searchProducts').mockResolvedValue({
      success: true,
      data: {
        total: 0,
        pageNum: 1,
        pageSize: 20,
        list: [],
      },
    });
    const res = await POST(jsonPost({ source: 'cj', keywords: 'zzzznotfound123' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { imported: number; message?: string; products: unknown[] };
    expect(body.imported).toBe(0);
    expect(body.products).toEqual([]);
  });

  it('returns 503 when supplier search fails', async () => {
    vi.spyOn(cj, 'searchProducts').mockResolvedValue({
      success: false,
      error: 'API down',
    });
    const res = await POST(jsonPost({ source: 'cj', keywords: 'phone' }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('API down');
  });

  it('returns products when search succeeds without autoImport', async () => {
    vi.spyOn(cj, 'searchProducts').mockResolvedValue({
      success: true,
      data: {
        total: 1,
        pageNum: 1,
        pageSize: 5,
        list: [mockCjProduct],
      },
    });
    const res = await POST(jsonPost({ source: 'cj', keywords: 'case', limit: 5, autoImport: false }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; searched: number; imported: number };
    expect(body.success).toBe(true);
    expect(body.searched).toBe(1);
    expect(body.imported).toBe(0);
  });

  it('uses AliExpress branch when source is aliexpress', async () => {
    vi.spyOn(aliexpress, 'searchProducts').mockResolvedValue({
      success: true,
      data: {
        current_page_no: 1,
        current_record_count: 1,
        total_record_count: 1,
        products: [mockAeProduct],
      },
    });
    const res = await POST(jsonPost({ source: 'aliexpress', keywords: 'gadget', autoImport: false }));
    expect(res.status).toBe(200);
    expect(aliexpress.searchProducts).toHaveBeenCalled();
    expect(cj.searchProducts).not.toHaveBeenCalled();
  });
});
