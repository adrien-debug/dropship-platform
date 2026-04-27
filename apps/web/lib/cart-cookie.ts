import { cookies } from 'next/headers';

export const CART_COOKIE = 'dropship_cart_id';
// Tracks the last /shop/[slug] the user interacted with so /cart, /checkout
// and /order/[id] can keep the merchant's branding instead of falling back
// to the generic "Dropship Store" shell. Survives cart completion (we don't
// clear it together with CART_COOKIE).
export const LAST_STORE_SLUG_COOKIE = 'dropship_last_store_slug';

export async function getCartId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function setCartId(id: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCartId(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}

export async function getLastStoreSlug(): Promise<string | null> {
  const store = await cookies();
  return store.get(LAST_STORE_SLUG_COOKIE)?.value ?? null;
}

export async function setLastStoreSlug(slug: string): Promise<void> {
  const store = await cookies();
  store.set(LAST_STORE_SLUG_COOKIE, slug, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
