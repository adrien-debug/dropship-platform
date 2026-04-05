'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { shippingEur, type ShippingMethod } from '@/lib/shipping';

const STORAGE_KEY = 'onepeace-shop-cart';
const PROMO_STORAGE_KEY = 'onepeace-shop-promo-code';

export type CartLine = {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
};

export type ValidatedDiscount = {
  code: string;
  discountCents: number;
  finalCents: number;
  freeShipping: boolean;
};

type CartContextValue = {
  items: CartLine[];
  promoCode: string;
  validatedDiscount: ValidatedDiscount | null;
  setPromoCode: (code: string) => void;
  setValidatedDiscount: (d: ValidatedDiscount | null) => void;
  addItem: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  discountEur: number;
  shippingEurFor: (method: ShippingMethod) => number;
  totalFor: (method: ShippingMethod) => number;
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

function loadPromoCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PROMO_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [promoCode, setPromoCodeState] = useState('');
  const [validatedDiscount, setValidatedDiscount] = useState<ValidatedDiscount | null>(null);

  useEffect(() => {
    setItems(loadItems());
    setPromoCodeState(loadPromoCode());
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

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (promoCode) window.localStorage.setItem(PROMO_STORAGE_KEY, promoCode);
      else window.localStorage.removeItem(PROMO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [promoCode, hydrated]);

  const setPromoCode = useCallback((code: string) => {
    setPromoCodeState(code);
    setValidatedDiscount(null);
  }, []);

  const addItem = useCallback((line: Omit<CartLine, 'quantity'> & { quantity?: number }) => {
    const qty = line.quantity ?? 1;
    console.log('[CartContext] addItem called with:', line, 'qty:', qty);
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === line.productId);
      console.log('[CartContext] Previous items:', prev, 'Found index:', i);
      if (i === -1) {
        const newItems = [...prev, { ...line, quantity: qty }];
        console.log('[CartContext] New items after add:', newItems);
        return newItems;
      }
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + qty };
      console.log('[CartContext] Updated items after increment:', next);
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
    setValidatedDiscount(null);
    setPromoCodeState('');
  }, []);

  const subtotal = useMemo(
    () => items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [items],
  );

  const discountEur = useMemo(() => {
    if (!validatedDiscount) return 0;
    return validatedDiscount.discountCents / 100;
  }, [validatedDiscount]);

  const subtotalAfterDiscount = useMemo(
    () => Math.max(0, subtotal - discountEur),
    [subtotal, discountEur],
  );

  const shippingEurFor = useCallback(
    (method: ShippingMethod) => {
      if (validatedDiscount?.freeShipping) return 0;
      return shippingEur(method, subtotalAfterDiscount);
    },
    [validatedDiscount, subtotalAfterDiscount],
  );

  const totalFor = useCallback(
    (method: ShippingMethod) => subtotalAfterDiscount + shippingEurFor(method),
    [subtotalAfterDiscount, shippingEurFor],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      promoCode,
      validatedDiscount,
      setPromoCode,
      setValidatedDiscount,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal,
      discountEur,
      shippingEurFor,
      totalFor,
    }),
    [
      items,
      promoCode,
      validatedDiscount,
      setPromoCode,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      subtotal,
      discountEur,
      shippingEurFor,
      totalFor,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
