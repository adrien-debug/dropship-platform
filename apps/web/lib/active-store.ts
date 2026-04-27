import { getLastStoreSlug } from './cart-cookie';
import { getStoreBySalesChannelId, getStoreBySlug, type StoreConfig } from './store-config';
import type { StoreCart } from './medusa-store';

/**
 * Resolve the merchant store the customer is currently shopping with.
 *
 * Order of resolution:
 *   1. The cookie set by addToCart(slug) — most reliable, survives across
 *      cart/checkout/order pages even after the cart is completed and cleared.
 *   2. Reverse-lookup via cart.sales_channel_id when we have a cart and no
 *      cookie (e.g. user came back to /cart on a different device).
 *
 * Returns null if neither path finds an active store, in which case the
 * caller should render the generic StoreShell.
 */
export async function resolveActiveStore(cart?: StoreCart | null): Promise<StoreConfig | null> {
  const slug = await getLastStoreSlug();
  if (slug) {
    const store = await getStoreBySlug(slug);
    if (store) return store;
  }
  if (cart?.sales_channel_id) {
    return getStoreBySalesChannelId(cart.sales_channel_id);
  }
  return null;
}
