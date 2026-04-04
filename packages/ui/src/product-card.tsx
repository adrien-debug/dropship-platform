import React from 'react';
import clsx from 'clsx';
import type { ProductDto } from '@dropship/core';

export interface ProductCardProps {
  product: ProductDto;
  onAddToCart?: (product: ProductDto) => void;
  className?: string;
}

export function ProductCard({ product, onAddToCart, className }: ProductCardProps) {
  const price = (product.priceCents / 100).toFixed(2);

  return (
    <article className={clsx('group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md', className)}>
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        {product.imageUrls[0] && (
          <img
            src={product.imageUrls[0]}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {product.shippingDays && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
            {product.shippingDays.min}-{product.shippingDays.max}j
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        <p className="mt-auto text-lg font-bold">{price} EUR</p>
        {onAddToCart && (
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="mt-2 w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Ajouter au panier
          </button>
        )}
      </div>
    </article>
  );
}
