'use client';

import Image from 'next/image';
import Link from 'next/link';

const CATEGORIES: {
  name: string;
  slug: string;
  character: string;
}[] = [
  { name: 'Figurines', slug: 'Figurines', character: '/characters/luffy.png' },
  { name: 'Mugs', slug: 'Mugs', character: '/characters/sanji.png' },
  { name: 'T-Shirts', slug: 'T-Shirts', character: '/characters/zoro.png' },
  { name: 'Posters', slug: 'Posters', character: '/characters/ace.png' },
  { name: 'Stickers', slug: 'Stickers', character: '/characters/chopper.png' },
  { name: 'Accessoires', slug: 'Accessoires', character: '/characters/nami.png' },
  { name: 'Peluches', slug: 'Peluches', character: '/characters/chopper.png' },
  { name: 'Coques iPhone', slug: 'Coques iPhone', character: '/characters/robin.png' },
  { name: 'Slimes', slug: 'Slimes', character: '/characters/brook.png' },
  { name: 'Porte-cles', slug: 'Porte-cles', character: '/characters/franky.png' },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--op-cream)' }}>
      {/* Title */}
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1
            className="text-3xl font-bold tracking-widest sm:text-4xl"
            style={{ color: 'var(--op-ink)', fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            CATEGORIES
          </h1>
          <div
            className="mt-3 h-1 w-24 rounded-full"
            style={{ background: 'var(--op-brand)' }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat, idx) => (
            <Link
              key={cat.slug}
              href={`/shop?category=${encodeURIComponent(cat.slug)}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border-2 border-transparent transition-all duration-300 hover:border-[var(--op-brand)]"
              style={{ boxShadow: 'var(--op-shadow)' }}
            >
              {/* Character background */}
              <Image
                src={cat.character}
                alt={cat.name}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  animationDelay: `${idx * 60}ms`,
                }}
              />

              {/* Dark gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.1) 100%)',
                }}
              />

              {/* Category name */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <h2
                  className="text-2xl font-bold tracking-wide text-white sm:text-3xl"
                  style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
                >
                  {cat.name}
                </h2>
                <span
                  className="mt-2 inline-block text-sm font-semibold tracking-wider text-white/80 transition-colors group-hover:text-white"
                >
                  Voir les produits
                </span>
              </div>

              {/* Red accent bar on hover */}
              <div
                className="absolute bottom-0 left-0 h-1 w-0 transition-all duration-300 group-hover:w-full"
                style={{ background: 'var(--op-brand)' }}
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
