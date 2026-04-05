import { createAdminClient } from '@/utils/supabase/admin';
import type { ProductDto, ProductListResponse, ProductSort } from './product-types';

interface DbProduct {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  in_stock: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

function toDto(row: DbProduct): ProductDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    inStock: row.in_stock,
    imageUrls: row.image_urls,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FetchProductsParams {
  page: number;
  limit: number;
  category: string;
  stock: 'all' | 'in_stock' | 'out_of_stock';
  priceMinCents: number | null;
  priceMaxCents: number | null;
  q: string;
  sort: ProductSort;
}

export function buildProductsQueryString(params: FetchProductsParams): string {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('limit', String(params.limit));
  sp.set('sort', params.sort);
  if (params.category.trim()) sp.set('category', params.category.trim());
  if (params.stock === 'in_stock') sp.set('in_stock', 'true');
  else if (params.stock === 'out_of_stock') sp.set('in_stock', 'false');
  if (params.priceMinCents !== null && params.priceMinCents >= 0)
    sp.set('price_min', String(params.priceMinCents));
  if (params.priceMaxCents !== null && params.priceMaxCents >= 0)
    sp.set('price_max', String(params.priceMaxCents));
  if (params.q.trim()) sp.set('q', params.q.trim());
  return sp.toString();
}

const SORT_MAP: Record<ProductSort, { column: string; ascending: boolean }> = {
  price_asc: { column: 'price_cents', ascending: true },
  price_desc: { column: 'price_cents', ascending: false },
  new: { column: 'created_at', ascending: false },
  popular: { column: 'created_at', ascending: false },
  random: { column: 'id', ascending: true },
};

export async function fetchProducts(params: FetchProductsParams): Promise<ProductListResponse> {
  const supabase = createAdminClient();
  const offset = (params.page - 1) * params.limit;

  let query = supabase.from('products').select('*', { count: 'exact' });

  if (params.category.trim()) {
    query = query.eq('category', params.category.trim());
  }
  if (params.stock === 'in_stock') query = query.eq('in_stock', true);
  else if (params.stock === 'out_of_stock') query = query.eq('in_stock', false);

  if (params.priceMinCents !== null && params.priceMinCents >= 0) {
    query = query.gte('price_cents', params.priceMinCents);
  }
  if (params.priceMaxCents !== null && params.priceMaxCents >= 0) {
    query = query.lte('price_cents', params.priceMaxCents);
  }
  if (params.q.trim()) {
    query = query.ilike('name', `%${params.q.trim()}%`);
  }

  const sortCfg = SORT_MAP[params.sort] ?? SORT_MAP.new;
  query = query.order(sortCfg.column, { ascending: sortCfg.ascending });
  query = query.range(offset, offset + params.limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Products query failed: ${error.message}`);

  const rows = (data ?? []) as DbProduct[];
  return {
    items: rows.map(toDto),
    total: count ?? 0,
    page: params.page,
    limit: params.limit,
  };
}

export async function fetchCategories(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .order('category');

  if (error) throw new Error(`Categories query failed: ${error.message}`);

  const unique = [...new Set((data ?? []).map((r: { category: string }) => r.category))];
  return unique.filter(Boolean);
}
