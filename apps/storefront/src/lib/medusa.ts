const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || process.env.MEDUSA_URL || 'http://100.110.74.114:9000';
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || 'REDACTED_MEDUSA_PK';
const REGION_ID = process.env.NEXT_PUBLIC_MEDUSA_REGION_ID || 'reg_01KNCT3QEHAN10H1R98PM3XT2B';

type Json = Record<string, unknown>;

async function medusaFetch(path: string, opts?: RequestInit): Promise<Json> {
  const res = await fetch(`${MEDUSA_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-publishable-api-key': PUB_KEY,
      ...(opts?.headers || {}),
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[medusa] ${res.status} ${path}: ${text.slice(0, 200)}`);
    throw new Error(`Medusa ${res.status}`);
  }
  return res.json() as Promise<Json>;
}

export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  thumbnail: string | null;
  images: { id: string; url: string }[];
  variants: MedusaVariant[];
  categories: { id: string; name: string }[];
  status: string;
}

export interface MedusaVariant {
  id: string;
  title: string;
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
}

export async function getProducts(opts?: {
  category_id?: string[];
  limit?: number;
  offset?: number;
  q?: string;
  order?: string;
}): Promise<{ products: MedusaProduct[]; count: number }> {
  const params = new URLSearchParams();
  params.set('region_id', REGION_ID);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.q) params.set('q', opts.q);
  if (opts?.order) params.set('order', opts.order);
  if (opts?.category_id) {
    for (const id of opts.category_id) params.append('category_id[]', id);
  }
  params.set('fields', '+categories');

  const data = await medusaFetch(`/store/products?${params.toString()}`);
  return {
    products: (data.products || []) as MedusaProduct[],
    count: (data.count || 0) as number,
  };
}

export async function getProductByHandle(handle: string): Promise<MedusaProduct | null> {
  try {
    const data = await medusaFetch(`/store/products?handle=${handle}&region_id=${REGION_ID}&fields=+categories`);
    const products = (data.products || []) as MedusaProduct[];
    return products[0] || null;
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<{ id: string; name: string; handle: string }[]> {
  const data = await medusaFetch('/store/product-categories?limit=100');
  return ((data.product_categories || []) as { id: string; name: string; handle: string }[])
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCart(): Promise<string> {
  const data = await medusaFetch('/store/carts', {
    method: 'POST',
    body: JSON.stringify({ region_id: REGION_ID }),
  });
  return ((data.cart || {}) as { id: string }).id;
}

export async function getCart(cartId: string): Promise<Json> {
  const data = await medusaFetch(`/store/carts/${cartId}`);
  return (data.cart || {}) as Json;
}

export async function addToCart(cartId: string, variantId: string, quantity = 1): Promise<Json> {
  const data = await medusaFetch(`/store/carts/${cartId}/line-items`, {
    method: 'POST',
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
  return (data.cart || {}) as Json;
}

export async function updateLineItem(cartId: string, lineItemId: string, quantity: number): Promise<Json> {
  const data = await medusaFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
  return (data.cart || {}) as Json;
}

export async function removeLineItem(cartId: string, lineItemId: string): Promise<Json> {
  const data = await medusaFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: 'DELETE',
  });
  return (data.cart || {}) as Json;
}

export { MEDUSA_URL, PUB_KEY, REGION_ID };
