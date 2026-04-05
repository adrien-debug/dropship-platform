'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/cart-context';
import type { ProductDto } from '@/types/product';
import { motion } from 'motion/react';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';

function formatEur(cents: number): string {
  return `${Math.round(cents / 100)}€`;
}

const NEWS_ITEMS = [
  {
    category: 'FIGURINES',
    date: '2026/04/05',
    title: 'Nouvelle collection Gear 5 — Luffy en edition limitee disponible en pre-commande',
    img: '/characters/luffy.png',
  },
  {
    category: 'GOODIES',
    date: '2026/04/05',
    title: 'Zoro x Enma — La collection exclusive de sabres decoratifs arrive en boutique',
    img: '/characters/zoro.png',
  },
  {
    category: 'MUGS',
    date: '2026/04/04',
    title: 'Les mugs Straw Hat Crew — Toute la bande reunis sur votre tasse du matin',
    img: '/characters/nami.png',
  },
  {
    category: 'T-SHIRTS',
    date: '2026/04/04',
    title: 'Collection Sanji Premium — T-shirts haute qualite avec designs exclusifs',
    img: '/characters/sanji.png',
  },
];

const CATEGORY_ORDER = [
  'Figurines',
  'T-Shirts',
  'Hoodies',
  'Mugs',
  'Posters',
  'Gourdes',
  'Peluches',
  'Casquettes',
  'Coques',
  'Stickers',
  'Puzzles',
  'Slimes',
];

const CATEGORY_ICONS: Record<string, string> = {
  Figurines: '/products/figurines/fig-luffy.png',
  'T-Shirts': '/products/tshirts/tshirt-luffy.png',
  Hoodies: '/products/hoodies/hoodie-luffy.png',
  Mugs: '/products/mugs/mug-luffy.png',
  Posters: '/products/posters/poster-luffy.png',
  Gourdes: '/products/gourdes/bottle-luffy.png',
  Peluches: '/products/peluches/plush-luffy.png',
  Casquettes: '/products/casquettes/cap-luffy.png',
  Coques: '/products/coques/case-luffy.png',
  Stickers: '/products/stickers/stickers-luffy.png',
  Puzzles: '/products/puzzles/puzzle-luffy.png',
  Slimes: '/products/slimes/slime-luffy.png',
};

export default function OnePiecePage() {
  const { items: cartItems, addItem } = useCart();
  const cartCount = cartItems.reduce((s, l) => s + l.quantity, 0);
  const [productsByCategory, setProductsByCategory] = useState<Record<string, ProductDto[]>>({});
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?limit=300&sort=new', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          const grouped: Record<string, ProductDto[]> = {};
          for (const p of data.items as ProductDto[]) {
            const cat = p.category || 'Autre';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
          }
          setProductsByCategory(grouped);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const sortedCategories = CATEGORY_ORDER.filter(c => productsByCategory[c]?.length);

  const handleAdd = (product: ProductDto) => {
    addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrls[0] ?? '',
      unitPrice: product.priceCents / 100,
    });
  };

  return (
    <div className="flex flex-col font-['Noto_Sans_JP',sans-serif]">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-10" 
          style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/p6-dark.png")' }} 
        />
        
        <div className="mx-auto max-w-[1200px] px-4 py-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="md:col-span-8">
              <Link href="/shop">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative aspect-[16/9] overflow-hidden rounded-xl shadow-[var(--op-shadow)] transition-all hover:shadow-[var(--op-shadow-hover)] cursor-pointer bg-[#fdf2f2]"
                >
                  <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity" 
                    style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #D9312B 0%, transparent 70%)' }} 
                  />
                  <div className="absolute inset-0 opacity-5" 
                    style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} 
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <motion.img
                      src="/characters/luffy.png"
                      alt="One Piece Main Banner"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110 mix-blend-multiply"
                    />
                  </div>
                  
                  <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8">
                    <motion.span 
                      whileHover={{ scale: 1.1 }}
                      className="mb-3 inline-block rounded-full bg-[#D9312B] px-4 py-1 text-[10px] font-black tracking-widest text-white shadow-lg"
                    >
                      NEW COLLECTION
                    </motion.span>
                    <h2 className="text-2xl font-black text-white md:text-4xl leading-none italic uppercase">
                      L'aventure <span className="text-[#D9312B]">Grand Line</span> commence ici
                    </h2>
                    <div className="mt-4 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                      <span className="text-xs font-bold tracking-widest uppercase">Découvrir l'exclusivité</span>
                      <span className="text-lg group-hover:translate-x-2 transition-transform">→</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>

            <div className="flex flex-col gap-5 md:col-span-4">
              <Link href="/shop?category=Mugs">
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="group relative overflow-hidden rounded-xl shadow-[var(--op-shadow)] transition-all hover:shadow-[var(--op-shadow-hover)] cursor-pointer aspect-[3/2] bg-[#fff5f8]"
                >
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" 
                    style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #FFB6C1 0%, transparent 70%)' }} 
                  />
                  <div className="absolute right-0 h-full w-1/2 flex items-center justify-center p-2">
                    <motion.img
                      src="/characters/chopper.png"
                      alt="Mugs Collection"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110 mix-blend-multiply"
                    />
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-center p-6 bg-gradient-to-r from-black/70 via-black/20 to-transparent">
                    <p className="text-xs font-black text-[#FFB6C1] tracking-widest uppercase mb-1">Kawaii Selection</p>
                    <h3 className="text-xl font-black text-white italic leading-tight uppercase">Mugs<br/>Collection</h3>
                    <p className="mt-2 text-[10px] font-bold text-white/70">À partir de 14.90€</p>
                  </div>
                </motion.div>
              </Link>

              <Link href="/shop?category=T-Shirts">
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="group relative overflow-hidden rounded-xl shadow-[var(--op-shadow)] transition-all hover:shadow-[var(--op-shadow-hover)] cursor-pointer aspect-[3/2] bg-[#fffaf0]"
                >
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" 
                    style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #FF8C00 0%, transparent 70%)' }} 
                  />
                  <div className="absolute right-0 h-full w-1/2 flex items-center justify-center p-2">
                    <motion.img
                      src="/characters/ace.png"
                      alt="T-Shirts Premium"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110 mix-blend-multiply"
                    />
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-center p-6 bg-gradient-to-r from-black/70 via-black/20 to-transparent">
                    <p className="text-xs font-black text-[#FF8C00] tracking-widest uppercase mb-1">Fire Style</p>
                    <h3 className="text-xl font-black text-white italic leading-tight uppercase">T-Shirts<br/>Premium</h3>
                    <p className="mt-2 text-[10px] font-bold text-white/70">À partir de 24.90€</p>
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="py-12">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="mb-8 flex items-end justify-between border-b-[3px] border-[#D9312B] pb-3">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black italic text-[var(--op-ink)]">NEWS</h2>
              <span className="text-[10px] font-bold text-[var(--op-muted)] uppercase tracking-[0.2em]">
                Latest Information
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {NEWS_ITEMS.map((item, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group flex cursor-pointer flex-col bg-white rounded-md overflow-hidden shadow-[var(--op-shadow)] hover:shadow-[var(--op-shadow-hover)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f5f5f5]">
                  <div className="absolute top-2 left-2 z-10 bg-[#D9312B] px-2 py-0.5 text-[9px] font-bold text-white rounded-[2px]">
                    {item.category}
                  </div>
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col p-4 gap-2">
                  <span className="text-[10px] font-medium text-[var(--op-muted)]">{item.date}</span>
                  <h3 className="text-[13px] font-bold leading-relaxed text-[var(--op-ink)] group-hover:text-[#D9312B] line-clamp-2 transition-colors">
                    {item.title}
                  </h3>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Navigation */}
      <section className="py-10 bg-white border-b border-[var(--op-border)]">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="mb-6 flex items-end justify-between border-b-[3px] border-[#D9312B] pb-3">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black italic text-[var(--op-ink)]">SHOP</h2>
              <span className="text-[10px] font-bold text-[var(--op-muted)] uppercase tracking-[0.2em]">
                {Object.values(productsByCategory).reduce((s, arr) => s + arr.length, 0)} produits
              </span>
            </div>
            <Link
              href="/cart"
              className="flex items-center gap-2 rounded-full bg-[#D9312B] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--op-brand-hover)] transition-colors"
            >
              <ShoppingBagIcon className="size-4" />
              PANIER ({cartCount})
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="size-20 animate-pulse rounded-xl bg-[var(--op-border)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--op-border)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {sortedCategories.map((cat, i) => (
                <Link key={cat} href={`/shop?category=${encodeURIComponent(cat)}`}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:bg-[var(--op-cream)] hover:-translate-y-1"
                  >
                    <div className="relative size-20 overflow-hidden rounded-xl border-2 border-[var(--op-border)] bg-[#f8f8f8] shadow-sm transition-all group-hover:border-[#D9312B] group-hover:shadow-md">
                      <img
                        src={CATEGORY_ICONS[cat] ?? ''}
                        alt={cat}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-[var(--op-ink)] group-hover:text-[#D9312B] transition-colors">
                        {cat.toUpperCase()}
                      </p>
                      <p className="text-[9px] text-[var(--op-muted)]">
                        {productsByCategory[cat]?.length ?? 0} articles
                      </p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Products by Category */}
      {!loading && sortedCategories.map((cat, catIdx) => {
        const items = productsByCategory[cat] ?? [];
        const display = items.slice(0, 4);
        const hasMore = items.length > 4;

        return (
          <section
            key={cat}
            className="py-10"
            style={{ background: catIdx % 2 === 0 ? 'var(--op-cream)' : 'white' }}
          >
            <div className="mx-auto max-w-[1200px] px-4">
              <div className="mb-6 flex items-end justify-between border-b-[3px] border-[#D9312B] pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black italic text-[var(--op-ink)]">
                    {cat.toUpperCase()}
                  </h3>
                  <span className="rounded-full bg-[#D9312B]/10 px-3 py-0.5 text-[10px] font-bold text-[#D9312B]">
                    {items.length} articles
                  </span>
                </div>
                {hasMore && (
                  <Link
                    href={`/shop?category=${encodeURIComponent(cat)}`}
                    className="flex items-center gap-1 text-xs font-bold text-[#D9312B] hover:opacity-70 transition-opacity"
                  >
                    VOIR TOUT ({items.length})
                    <span className="text-[10px]">&#9654;</span>
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {display.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex cursor-pointer flex-col bg-white rounded-md overflow-hidden shadow-[var(--op-shadow)] hover:shadow-[var(--op-shadow-hover)] hover:-translate-y-1 transition-all duration-300 border border-[var(--op-border)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
                      <img
                        src={product.imageUrls[0] ?? '/placeholder-product.svg'}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      {!product.inStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--op-ink)]">
                            Rupture de stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col p-3 gap-2">
                      <h4 className="text-[12px] font-bold leading-tight text-[var(--op-ink)] group-hover:text-[#D9312B] transition-colors line-clamp-2">
                        {product.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-[#D9312B]">
                          {formatEur(product.priceCents)}
                        </span>
                        <button
                          onClick={() => handleAdd(product)}
                          disabled={!product.inStock}
                          className="rounded-full bg-[var(--op-ink)] px-3 py-1.5 text-[9px] font-bold text-white hover:bg-[#D9312B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          AJOUTER
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <Link
                    href={`/shop?category=${encodeURIComponent(cat)}`}
                    className="flex items-center gap-2 rounded-full border-2 border-[#D9312B] px-5 py-2 text-[11px] font-bold text-[#D9312B] hover:bg-[#D9312B] hover:text-white transition-colors"
                  >
                    VOIR LES {items.length} {cat.toUpperCase()}
                    <span className="text-[10px]">&#9654;</span>
                  </Link>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
