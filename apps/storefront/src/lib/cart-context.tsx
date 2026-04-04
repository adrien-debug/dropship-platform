'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MEDUSA_URL, PUB_KEY, REGION_ID } from './medusa';

type Json = Record<string, unknown>;

interface CartContextValue {
  cart: Json | null;
  itemCount: number;
  loading: boolean;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  cart: null,
  itemCount: 0,
  loading: false,
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  refreshCart: async () => {},
  clearCart: () => {},
});

export function useCart() {
  return useContext(CartContext);
}

async function clientFetch(path: string, opts?: RequestInit): Promise<Json> {
  const res = await fetch(`${MEDUSA_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-publishable-api-key': PUB_KEY,
      ...(opts?.headers || {}),
    },
  });
  return res.json() as Promise<Json>;
}

function getCartId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('medusa_cart_id');
}

function setCartId(id: string) {
  localStorage.setItem('medusa_cart_id', id);
}

function getItemCount(cart: Json | null): number {
  if (!cart) return 0;
  const items = (cart.items || []) as { quantity: number }[];
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Json | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async (id: string) => {
    try {
      const data = await clientFetch(`/store/carts/${id}`);
      setCart((data.cart || null) as Json | null);
    } catch {
      localStorage.removeItem('medusa_cart_id');
      setCart(null);
    }
  }, []);

  useEffect(() => {
    const id = getCartId();
    if (id) fetchCart(id);
  }, [fetchCart]);

  const ensureCart = useCallback(async (): Promise<string> => {
    let id = getCartId();
    if (!id) {
      const data = await clientFetch('/store/carts', {
        method: 'POST',
        body: JSON.stringify({ region_id: REGION_ID }),
      });
      id = ((data.cart || {}) as { id: string }).id;
      setCartId(id);
    }
    return id;
  }, []);

  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    setLoading(true);
    try {
      const cartId = await ensureCart();
      const data = await clientFetch(`/store/carts/${cartId}/line-items`, {
        method: 'POST',
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      setCart((data.cart || null) as Json | null);
    } finally {
      setLoading(false);
    }
  }, [ensureCart]);

  const updateItem = useCallback(async (lineItemId: string, quantity: number) => {
    const cartId = getCartId();
    if (!cartId) return;
    setLoading(true);
    try {
      const data = await clientFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
      setCart((data.cart || null) as Json | null);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (lineItemId: string) => {
    const cartId = getCartId();
    if (!cartId) return;
    setLoading(true);
    try {
      const data = await clientFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
        method: 'DELETE',
      });
      setCart((data.cart || null) as Json | null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    const id = getCartId();
    if (id) await fetchCart(id);
  }, [fetchCart]);

  const clearCart = useCallback(() => {
    localStorage.removeItem('medusa_cart_id');
    setCart(null);
  }, []);

  return (
    <CartContext.Provider value={{ cart, itemCount: getItemCount(cart), loading, addItem, updateItem, removeItem, refreshCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
