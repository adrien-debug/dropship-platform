'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'motion/react';
import type { ShopCategory } from '@/data/shop-home-data';

export type CategoryCardProps = {
  category: ShopCategory;
  index?: number;
};

export function CategoryCard({ category, index = 0 }: CategoryCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={category.href}
        className="group relative block overflow-hidden rounded-2xl border border-op-brand/15 bg-op-card shadow-sm"
      >
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={category.imageSrc}
            alt={category.imageAlt}
            fill
            sizes="(min-width: 1024px) 25vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-op-ink/70 via-op-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h3 className="font-display text-2xl text-op-cream sm:text-3xl">{category.title}</h3>
            <p className="mt-1 max-w-prose text-sm text-op-cream/90">{category.description}</p>
            <span className="mt-3 inline-flex items-center text-sm font-semibold text-op-cream underline decoration-op-brand decoration-2 underline-offset-4">
              Browse
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
