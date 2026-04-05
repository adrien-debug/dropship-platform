import { createAdminClient } from '@/utils/supabase/admin';
import type { ProductDto } from './product-types';

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

export type FetchProductResult =
  | { ok: true; product: ProductDto }
  | { ok: false; status: number; message: string };

export async function fetchProductById(id: string): Promise<FetchProductResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { ok: false, status: 404, message: 'Product not found' };
    }
    return { ok: false, status: 500, message: error.message };
  }

  return { ok: true, product: toDto(data as DbProduct) };
}

export async function fetchRelatedProducts(
  category: string,
  excludeId: string,
  limit: number,
): Promise<ProductDto[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category', category)
    .eq('in_stock', true)
    .neq('id', excludeId)
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as DbProduct[]).map(toDto);
}
