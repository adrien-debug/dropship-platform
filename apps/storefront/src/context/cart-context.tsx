'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'onepeace-shop-cart';

export type CartLine = {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  addItem: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadItems(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is CartLine =>
        row != null &&
        typeof row === 'object' &&
        typeof (row as CartLine).productId === 'string' &&
        typeof (row as CartLine).name === 'string' &&
        typeof (row as CartLine).imageUrl === 'string' &&
        typeof (row as CartLine).unitPrice === 'number' &&
        typeof (row as CartLine).quantity === 'number',
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota */
    }
  }, [items, hydrated]);

  const addItem = useCallback((line: Omit<CartLine, 'quantity'> & { quantity?: number }) => {
    const qty = line.quantity ?? 1;
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === line.productId);
      if (i === -1) {
        return [...prev, { ...line, quantity: qty }];
      }
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + qty };
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(p => p.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems(prev => prev.map(p => (p.productId === productId ? { ...p, quantity } : p)));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
