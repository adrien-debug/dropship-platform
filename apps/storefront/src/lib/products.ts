import { createClient } from '@supabase/supabase-js';
import type { ProductDto } from '@dropship/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || '';

export async function getProducts(opts?: {
  category?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}): Promise<{ products: ProductDto[]; total: number }> {
  if (MEDUSA_URL) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const res = await fetch(`${MEDUSA_URL}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_KEY || '' },
    });
    const data = await res.json();
    return {
      products: (data.products ?? []).map(mapMedusaProduct),
      total: data.count ?? 0,
    };
  }
  return { products: [], total: 0 };
}

export async function getProductByHandle(handle: string): Promise<ProductDto | null> {
  if (MEDUSA_URL) {
    const res = await fetch(`${MEDUSA_URL}/store/products?handle=${handle}`, {
      headers: { 'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_KEY || '' },
    });
    const data = await res.json();
    return data.products?.[0] ? mapMedusaProduct(data.products[0]) : null;
  }
  return null;
}

function mapMedusaProduct(p: Record<string, unknown>): ProductDto {
  const variant = (p.variants as Record<string, unknown>[])?.[0];
  const prices = (variant?.prices as Record<string, unknown>[]) ?? [];
  const price = prices.find((pr: Record<string, unknown>) => pr.currency_code === 'eur') ?? prices[0];
  
  return {
    id: String(p.id),
    name: String(p.title ?? ''),
    description: String(p.description ?? ''),
    priceCents: Number(price?.amount ?? 0),
    category: String((p.collection as Record<string, unknown>)?.title ?? 'Uncategorized'),
    inStock: true,
    imageUrls: ((p.images as Record<string, unknown>[]) ?? []).map(i => String(i.url)),
    createdAt: String(p.created_at ?? ''),
    updatedAt: String(p.updated_at ?? ''),
  };
}
