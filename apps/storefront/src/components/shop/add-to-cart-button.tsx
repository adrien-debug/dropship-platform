'use client';

import { useState } from 'react';
import { useCart } from '@/context/cart-context';
import type { ProductDto } from '@/lib/product-types';

export function AddToCartButton({
  product,
  quantity,
  disabled,
}: {
  product: ProductDto;
  quantity: number;
  disabled?: boolean;
}) {
  const { addItem } = useCart();
  const [status, setStatus] = useState<'idle' | 'added'>('idle');

  const handleClick = () => {
    if (disabled || quantity < 1) return;
    console.log('[AddToCart] Adding item:', {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrls[0] ?? '',
      unitPrice: product.priceCents / 100,
      quantity,
    });
    addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrls[0] ?? '',
      unitPrice: product.priceCents / 100,
      quantity,
    });
    setStatus('added');
    window.setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <button
      type="button"
      disabled={disabled || quantity < 1}
      onClick={handleClick}
      className="min-h-[56px] w-full flex-1 rounded-[var(--dashboard-radius-input)] px-6 py-4 text-base font-semibold text-[var(--dashboard-page)] transition-[transform,opacity,box-shadow] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[240px]"
      style={{
        background: 'var(--dashboard-accent)',
        boxShadow: 'var(--dashboard-shadow-accent)',
      }}
    >
      {status === 'added' ? 'Added to cart' : 'Add to Cart'}
    </button>
  );
}
