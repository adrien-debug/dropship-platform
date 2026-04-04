import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductDto } from '@dropship/core';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function getProducts(opts?: {
  category?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  search?: string;
}): Promise<{ products: ProductDto[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });

  if (opts?.category) {
    query = query.eq('category', opts.category);
  }
  if (opts?.search) {
    query = query.ilike('name', `%${opts.search}%`);
  }

  const sortCol = opts?.sort === 'price-asc' || opts?.sort === 'price-desc' ? 'price_cents' : 'created_at';
  const ascending = opts?.sort === 'price-asc';
  query = query.order(sortCol, { ascending });

  if (opts?.limit) query = query.limit(opts.limit);
  if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[products] Supabase error:', error.message);
    return { products: [], total: 0 };
  }

  return {
    products: (data ?? []).map(mapDbProduct),
    total: count ?? 0,
  };
}

export async function getCategories(): Promise<string[]> {
  const { data } = await getSupabase()
    .from('products')
    .select('category')
    .order('category');
  const cats = [...new Set((data ?? []).map(d => d.category as string))];
  return cats.filter(Boolean);
}

export async function getProductByHandle(handle: string): Promise<ProductDto | null> {
  const { data } = await getSupabase()
    .from('products')
    .select('*')
    .eq('id', handle)
    .single();
  return data ? mapDbProduct(data) : null;
}

function mapDbProduct(p: Record<string, unknown>): ProductDto {
  return {
    id: String(p.id),
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    priceCents: Number(p.price_cents ?? 0),
    category: String(p.category ?? 'Uncategorized'),
    inStock: Boolean(p.in_stock),
    imageUrls: Array.isArray(p.image_urls) ? (p.image_urls as string[]) : [],
    createdAt: String(p.created_at ?? ''),
    updatedAt: String(p.updated_at ?? ''),
  };
}
