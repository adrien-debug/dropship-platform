'use client';

import Image from 'next/image';
import { motion } from 'motion/react';
import type { ShopProduct } from '@/data/shop-home-data';
import { useCart } from '@/context/cart-context';

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(priceCents / 100);
}

export type ProductCardProps = {
  product: ShopProduct;
  index?: number;
};

export function ProductCard({ product, index = 0 }: ProductCardProps): React.JSX.Element {
  const { addItem } = useCart();

  return (
    <motion.article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-op-brand/15 bg-op-card shadow-sm"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-op-cream">
        <Image
          src={product.imageSrc}
          alt={product.imageAlt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-lg leading-snug text-op-ink">{product.name}</h3>
        <p className="mt-auto text-sm font-semibold text-op-brand">
          {formatPrice(product.priceCents, product.currency)}
        </p>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center rounded-full bg-op-brand px-4 py-2.5 text-sm font-semibold text-op-cream transition hover:opacity-95 active:scale-[0.99]"
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              imageUrl: product.imageSrc,
              unitPrice: product.priceCents / 100,
              quantity: 1,
            })
          }
        >
          Add to Cart
        </button>
      </div>
    </motion.article>
  );
}
