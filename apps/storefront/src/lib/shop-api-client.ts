'use client';

const STORAGE_KEY = 'onepeace_shop_auth';

export interface ShopAuthState {
  token: string;
  customerId: string;
  email: string;
}

export function readShopAuth(): ShopAuthState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.token !== 'string' ||
      typeof o.customerId !== 'string' ||
      typeof o.email !== 'string'
    ) {
      return null;
    }
    return { token: o.token, customerId: o.customerId, email: o.email };
  } catch {
    return null;
  }
}

export function writeShopAuth(state: ShopAuthState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearShopAuth(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function shopFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = readShopAuth();
  const headers = new Headers(init.headers);
  if (auth?.token) {
    headers.set('Authorization', `Bearer ${auth.token}`);
  }
  return fetch(path, { ...init, headers });
}
