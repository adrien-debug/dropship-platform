'use client';

import { useCart } from '@/lib/cart-context';

export function CartBadge() {
  const { itemCount } = useCart();
  if (!itemCount) return null;
  return (
    <span className="absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
      {itemCount > 99 ? '99+' : itemCount}
    </span>
  );
}
