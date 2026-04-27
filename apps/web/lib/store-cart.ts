import {
  addLineItem,
  createCart,
  getCart,
  listRegions,
  removeLineItem,
  storefrontEnabled,
  updateLineItem,
  type StoreCart,
} from './medusa-store';
import { getCartId, setCartId } from './cart-cookie';
import { getStoreBySlug } from './store-config';

async function ensureRegionId(): Promise<string> {
  const { regions } = await listRegions();
  const r = regions[0];
  if (!r) throw new Error('No region configured in Medusa');
  return r.id;
}

interface StoreContext {
  salesChannelId: string;
  publishableKey: string;
}

async function resolveStoreContext(slug: string | undefined): Promise<StoreContext | null> {
  if (!slug) return null;
  const store = await getStoreBySlug(slug);
  if (!store?.medusaSalesChannelId || !store?.medusaPublishableKey) return null;
  return { salesChannelId: store.medusaSalesChannelId, publishableKey: store.medusaPublishableKey };
}

/**
 * Get-or-create a cart, optionally scoped to a store slug.
 *
 * Multi-store correctness: a Medusa cart is bound to a single sales_channel
 * for its whole life. If the cookie points at a cart that belongs to a
 * different store, we abandon it and create a fresh one — otherwise the
 * second add-to-cart would either fail or silently mix products from two
 * stores together (and Medusa wouldn't even price them correctly).
 */
export async function getOrCreateCart(slug?: string): Promise<StoreCart> {
  if (!storefrontEnabled()) throw new Error('Storefront non configuré');
  const ctx = await resolveStoreContext(slug);
  const existing = await getCartId();
  if (existing) {
    try {
      const { cart } = await getCart(existing);
      // Reuse only if the cart belongs to the right store (or no store was
      // requested, in which case any non-completed cart is fine).
      if (!ctx || cart.sales_channel_id === ctx.salesChannelId) return cart;
    } catch {
      // stale id — fall through and create a new cart
    }
  }

  const region_id = await ensureRegionId();
  const { cart } = await createCart({
    region_id,
    ...(ctx ? { sales_channel_id: ctx.salesChannelId, publishableKey: ctx.publishableKey } : {}),
  });
  await setCartId(cart.id);
  return cart;
}

export async function loadCart(): Promise<StoreCart | null> {
  if (!storefrontEnabled()) return null;
  const id = await getCartId();
  if (!id) return null;
  try {
    const { cart } = await getCart(id);
    return cart;
  } catch {
    return null;
  }
}

export async function addToCart(variantId: string, quantity: number, slug?: string): Promise<StoreCart> {
  const cart = await getOrCreateCart(slug);
  const ctx = await resolveStoreContext(slug);
  const { cart: updated } = await addLineItem(
    cart.id,
    { variant_id: variantId, quantity },
    ctx ? { publishableKey: ctx.publishableKey } : undefined,
  );
  return updated;
}

export async function setLineQuantity(lineItemId: string, quantity: number): Promise<StoreCart | null> {
  const id = await getCartId();
  if (!id) return null;
  if (quantity <= 0) {
    const { cart } = await removeLineItem(id, lineItemId);
    return cart;
  }
  const { cart } = await updateLineItem(id, lineItemId, { quantity });
  return cart;
}

export async function removeLine(lineItemId: string): Promise<StoreCart | null> {
  const id = await getCartId();
  if (!id) return null;
  const { cart } = await removeLineItem(id, lineItemId);
  return cart;
}
