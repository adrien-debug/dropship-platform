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

async function ensureRegionId(): Promise<string> {
  const { regions } = await listRegions();
  const r = regions[0];
  if (!r) throw new Error('No region configured in Medusa');
  return r.id;
}

export async function getOrCreateCart(): Promise<StoreCart> {
  if (!storefrontEnabled()) throw new Error('Storefront non configuré');
  const existing = await getCartId();
  if (existing) {
    try {
      const { cart } = await getCart(existing);
      return cart;
    } catch {
      // stale id — fall through and create a new cart
    }
  }
  const region_id = await ensureRegionId();
  const { cart } = await createCart({ region_id });
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

export async function addToCart(variantId: string, quantity: number): Promise<StoreCart> {
  const cart = await getOrCreateCart();
  const { cart: updated } = await addLineItem(cart.id, { variant_id: variantId, quantity });
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
