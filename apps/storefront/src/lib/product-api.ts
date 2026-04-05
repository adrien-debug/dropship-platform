import type { ProductDto } from './product-types';

function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const port = process.env.PORT || '3100';
  return `http://localhost:${port}`;
}

export type FetchProductResult =
  | { ok: true; product: ProductDto }
  | { ok: false; status: number; message: string };

export async function fetchProductById(id: string): Promise<FetchProductResult> {
  try {
    const res = await fetch(`${getApiBase()}/api/products?limit=300`, { next: { revalidate: 3600 } });
    if (!res.ok) return { ok: false, status: res.status, message: 'API error' };
    const data = await res.json();
    const product = (data.items as ProductDto[])?.find(p => p.id === id);
    if (!product) return { ok: false, status: 404, message: 'Product not found' };
    return { ok: true, product };
  } catch (e) {
    return { ok: false, status: 500, message: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function fetchRelatedProducts(
  category: string,
  excludeId: string,
  limit: number,
): Promise<ProductDto[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/products?category=${encodeURIComponent(category)}&limit=${limit + 1}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items ?? []) as ProductDto[]).filter(p => p.id !== excludeId).slice(0, limit);
  } catch {
    return [];
  }
}
