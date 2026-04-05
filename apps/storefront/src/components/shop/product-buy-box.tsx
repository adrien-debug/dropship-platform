'use client';

import { useState } from 'react';
import type { ProductDto } from '@/lib/product-types';
import { AddToCartButton } from './add-to-cart-button';
import { QuantitySelector } from './quantity-selector';

export function ProductBuyBox({ product }: { product: ProductDto }) {
  const [quantity, setQuantity] = useState(1);
  const disabled = !product.inStock;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <QuantitySelector
        value={quantity}
        onChange={setQuantity}
        disabled={disabled}
        max={99}
      />
      <AddToCartButton product={product} quantity={quantity} disabled={disabled} />
    </div>
  );
}
