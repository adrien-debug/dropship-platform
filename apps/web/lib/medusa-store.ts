/**
 * Medusa Store API client (publishable-key-based, used by the public storefront).
 * Distinct from the admin client in lib/medusa.ts.
 */
import { getMedusaBaseUrl } from './medusa';

export const MEDUSA_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '').trim();

export function storefrontEnabled(): boolean {
  return !!getMedusaBaseUrl() && !!MEDUSA_PUBLISHABLE_KEY;
}

interface StoreImage { id?: string; url: string }

export interface StoreVariant {
  id: string;
  title: string;
  sku?: string | null;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  calculated_price?: {
    calculated_amount: number;
    original_amount: number;
    currency_code: string;
  } | null;
}

export interface StoreProduct {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  handle: string;
  thumbnail?: string | null;
  images?: StoreImage[];
  variants?: StoreVariant[];
  collection_id?: string | null;
  tags?: { id: string; value: string }[];
}

export interface StoreCart {
  id: string;
  email?: string | null;
  currency_code: string;
  region_id?: string | null;
  sales_channel_id?: string | null;
  shipping_address?: StoreAddress | null;
  billing_address?: StoreAddress | null;
  items: StoreLineItem[];
  shipping_methods?: { id: string; shipping_option_id: string; name: string; amount: number }[];
  total: number;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
}

export interface StoreLineItem {
  id: string;
  product_id: string;
  variant_id: string;
  title: string;
  thumbnail?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total: number;
  product_handle?: string;
}

export interface StoreAddress {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  postal_code?: string;
  country_code?: string;
  province?: string;
  phone?: string;
  company?: string;
}

export interface StoreRegion {
  id: string;
  name: string;
  currency_code: string;
  countries?: { iso_2: string; display_name?: string }[];
}

export interface StoreShippingOption {
  id: string;
  name: string;
  amount: number;
  data?: Record<string, unknown>;
}

interface StoreFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  publishableKey?: string;
}

export async function storeFetch<T>(path: string, init: StoreFetchInit = {}): Promise<T> {
  const key = init.publishableKey || MEDUSA_PUBLISHABLE_KEY;
  const baseUrl = getMedusaBaseUrl();
  if (!baseUrl || !key) {
    throw new Error(
      'Storefront indisponible : MEDUSA_URL et/ou NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY non défini.',
    );
  }
  const { publishableKey: _, ...fetchInit } = init;
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      'x-publishable-api-key': key,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: init.cache ?? 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 280);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) detail = j.message;
    } catch {}
    throw new Error(`[Medusa Store] ${res.status} ${path} — ${detail}`);
  }
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

let _defaultRegionId: string | null = null;
async function getDefaultRegionId(): Promise<string | null> {
  if (_defaultRegionId) return _defaultRegionId;
  try {
    const { regions } = await listRegions();
    _defaultRegionId = regions[0]?.id ?? null;
    return _defaultRegionId;
  } catch {
    return null;
  }
}

export async function listProducts(
  params: { limit?: number; offset?: number; q?: string; handle?: string; regionId?: string; publishableKey?: string } = {},
): Promise<{ products: StoreProduct[]; count: number }> {
  const qs = new URLSearchParams();
  qs.set('fields', '*variants.calculated_price,+variants.inventory_quantity,+thumbnail,+images.url,+tags.value');
  const regionId = params.regionId ?? (await getDefaultRegionId());
  if (regionId) qs.set('region_id', regionId);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.q) qs.set('q', params.q);
  if (params.handle) qs.set('handle', params.handle);
  return storeFetch(`/store/products?${qs.toString()}`, { publishableKey: params.publishableKey });
}

export async function getProduct(handle: string, publishableKey?: string): Promise<StoreProduct | null> {
  const { products } = await listProducts({ handle, limit: 1, publishableKey });
  return products[0] ?? null;
}

export async function getProductByHandle(handle: string): Promise<StoreProduct | null> {
  return getProduct(handle);
}

export async function listRegions(): Promise<{ regions: StoreRegion[] }> {
  return storeFetch('/store/regions');
}

export async function createCart(
  input: { region_id: string; email?: string; sales_channel_id?: string; publishableKey?: string },
): Promise<{ cart: StoreCart }> {
  const { publishableKey, ...body } = input;
  return storeFetch('/store/carts', {
    method: 'POST',
    body: JSON.stringify(body),
    publishableKey,
  });
}

export async function getCart(cartId: string, opts?: { publishableKey?: string }): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}`, { publishableKey: opts?.publishableKey });
}

export async function addLineItem(
  cartId: string,
  input: { variant_id: string; quantity: number },
  opts?: { publishableKey?: string },
): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}/line-items`, {
    method: 'POST',
    body: JSON.stringify(input),
    publishableKey: opts?.publishableKey,
  });
}

export async function updateLineItem(cartId: string, lineItemId: string, input: { quantity: number }): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeLineItem(cartId: string, lineItemId: string): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, { method: 'DELETE' });
}

export async function updateCart(cartId: string, input: Partial<{ email: string; shipping_address: StoreAddress; billing_address: StoreAddress; region_id: string }>): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listShippingOptions(cartId: string): Promise<{ shipping_options: StoreShippingOption[] }> {
  return storeFetch(`/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`);
}

export async function setShippingMethod(cartId: string, optionId: string): Promise<{ cart: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}/shipping-methods`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}

interface PaymentCollection {
  id: string;
  payment_sessions?: { id: string; provider_id: string; data?: Record<string, unknown> }[];
}

export async function initPaymentSession(cartId: string, providerId: string): Promise<{ payment_collection: PaymentCollection }> {
  const created = await storeFetch<{ payment_collection: PaymentCollection }>(`/store/payment-collections`, {
    method: 'POST',
    body: JSON.stringify({ cart_id: cartId }),
  });

  return storeFetch<{ payment_collection: PaymentCollection }>(
    `/store/payment-collections/${created.payment_collection.id}/payment-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ provider_id: providerId }),
    },
  );
}

export async function completeCart(cartId: string): Promise<{ type: 'order' | 'cart'; order?: { id: string; display_id?: number }; cart?: StoreCart }> {
  return storeFetch(`/store/carts/${cartId}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Format a Medusa money amount.
 *
 * Medusa v2 stores money in **major units** (EUR with decimals, e.g. 9.99),
 * not minor units. Calculated prices, cart totals, line item totals,
 * shipping options and order totals all come back ready to display — the
 * payment-stripe module is the only place that converts to Stripe's
 * smallest unit by multiplying by 100.
 */
export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) {
    // Show a discreet placeholder rather than "— EUR", which leaks both an
    // em-dash and a raw ISO code into the UI.
    return '';
  }
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
