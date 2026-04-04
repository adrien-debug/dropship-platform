import React from 'react';
import clsx from 'clsx';
import type { ProductDto } from '@dropship/core';
import { ProductCard } from './product-card';

export interface ProductGridProps {
  items: ProductDto[];
  layout?: 'grid' | 'list';
  loading?: boolean;
  error?: string | null;
  onAddToCart?: (product: ProductDto) => void;
}

export function ProductGrid({ items, layout = 'grid', loading, error, onAddToCart }: ProductGridProps) {
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>;
  }

  if (loading) {
    return (
      <div className={clsx(
        layout === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4' : 'flex flex-col gap-4'
      )}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="py-16 text-center text-gray-500">Aucun produit trouve</div>;
  }

  return (
    <div className={clsx(
      layout === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4' : 'flex flex-col gap-4'
    )}>
      {items.map(product => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
