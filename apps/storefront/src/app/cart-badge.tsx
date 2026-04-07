'use client';

import { useCart } from '@/context/cart-context';

export function CartBadge() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  if (!itemCount) return null;
  return (
    <span className="absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
      {itemCount > 99 ? '99+' : itemCount}
    </span>
  );
}
