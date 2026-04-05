'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  ShoppingBagIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useCart } from '@/context/cart-context';

const NAV_ITEMS = [
  { label: '最新情報', sub: 'NEWS', href: '/new-arrivals' },
  { label: 'アニメ情報', sub: 'BOUTIQUE', href: '/shop' },
  { label: 'ワンピースとは', sub: 'ABOUT', href: '/#about' },
  { label: 'コミックス', sub: 'CATEGORIES', href: '/categories' },
  { label: 'グッズ・イベント', sub: 'GOODS / EVENT', href: '/cart' },
  { label: 'おたのしみ', sub: 'NEWSLETTER', href: '/newsletter' },
];

const SNS_ICONS = [
  { id: 'twitter', href: 'https://twitter.com/opcom_info', src: 'https://one-piece.com/common-one-piece/img/contents/header/sns-twitter.png' },
  { id: 'insta', href: 'https://www.instagram.com/onepiece_staff/', src: 'https://one-piece.com/common-one-piece/img/contents/header/sns-insta.png' },
  { id: 'line', href: 'https://line.me/R/ti/p/%40onepiece_official', src: 'https://one-piece.com/common-one-piece/img/contents/header/sns-line.png' },
  { id: 'youtube', href: 'https://www.youtube.com/channel/UCdAHaWcKdpbT5XkN2Er6BUQ', src: 'https://one-piece.com/common-one-piece/img/contents/header/sns-youtube.png' },
  { id: 'tiktok', href: 'https://www.tiktok.com/@onepiece.staff.official', src: 'https://one-piece.com/common-one-piece/img/contents/header/sns-tiktok.png' },
];

export function OnePieceHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((s, l) => s + l.quantity, 0);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="relative z-50 w-full bg-white font-['Noto_Sans_JP',sans-serif] text-[#333] border-t-[3px] border-[#D9312B]">
      <div className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between px-4 lg:h-[100px]">
        {/* Logo */}
        <div className="shrink-0">
          <Link href="/" className="block">
            <img
              src="/logo-onepiece.png"
              alt="ONE PIECE SHOP"
              className="h-[45px] w-auto lg:h-[80px]"
            />
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-4 lg:flex">
          {/* SNS */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-wider text-[#999]">SNS</span>
            <div className="flex gap-1.5">
              {SNS_ICONS.map(sns => (
                <a key={sns.id} href={sns.href} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-70">
                  <img src={sns.src} alt={sns.id} className="size-7 object-contain" />
                </a>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-[#eee]" />

          {/* Account */}
          <Link
            href="/account"
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
          >
            <UserCircleIcon className="size-6 text-[#333]" />
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
          >
            <ShoppingBagIcon className="size-6 text-[#333]" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#D9312B] text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* Search */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-[#f5f5f5]"
          >
            {isSearchOpen ? (
              <XMarkIcon className="size-6 text-[#D9312B]" />
            ) : (
              <MagnifyingGlassIcon className="size-6 text-[#333]" />
            )}
          </button>

          {/* Menu */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="group flex h-10 flex-col items-center justify-center gap-1 px-3"
          >
            <div className="flex flex-col gap-[3px] w-6">
              <span className={clsx('h-0.5 w-full bg-[#333] transition-all', isMenuOpen && 'translate-y-[5px] rotate-45')} />
              <span className={clsx('h-0.5 w-full bg-[#333] transition-opacity', isMenuOpen && 'opacity-0')} />
              <span className={clsx('h-0.5 w-full bg-[#333] transition-all', isMenuOpen && '-translate-y-[5px] -rotate-45')} />
            </div>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#333]">MENU</span>
          </button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-3 lg:hidden">
          <Link href="/cart" className="relative">
            <ShoppingBagIcon className="size-7 text-[#333]" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#D9312B] text-[8px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <Bars3Icon className="size-7 text-[#333]" />
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-0 top-full w-full border-t border-[#eee] bg-white py-8 shadow-xl"
          >
            <div className="mx-auto max-w-[800px] px-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  className="w-full rounded-full border-2 border-[#eee] py-4 pl-6 pr-12 text-base focus:border-[#D9312B] focus:outline-none"
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9312B]">
                  <MagnifyingGlassIcon className="size-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav Bar */}
      <nav className="hidden border-y border-[#eee] bg-white lg:block">
        <div className="mx-auto max-w-[1200px]">
          <ul className="flex justify-between">
            {NAV_ITEMS.map(item => (
              <li key={item.label} className="group relative flex-1 border-r border-[#eee] last:border-r-0">
                <Link
                  href={item.href}
                  className={clsx(
                    'flex h-[80px] flex-col items-center justify-center gap-0.5 transition-colors hover:bg-[#fcfcfc]',
                    isActive(item.href) && 'bg-[#fdf5f5]',
                  )}
                >
                  <span className={clsx(
                    'text-[13px] font-bold group-hover:text-[#D9312B] transition-colors',
                    isActive(item.href) ? 'text-[#D9312B]' : 'text-[#333]',
                  )}>
                    {item.label}
                  </span>
                  <span className="text-[9px] font-bold tracking-tighter text-[#999]">
                    {item.sub}
                  </span>
                </Link>
                <div className={clsx(
                  'absolute bottom-0 left-0 h-[3px] bg-[#D9312B] transition-all',
                  isActive(item.href) ? 'w-full' : 'w-0 group-hover:w-full',
                )} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Fullscreen Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white overflow-y-auto"
          >
            <div className="flex h-full flex-col">
              <div className="flex h-[70px] items-center justify-between px-4 border-b border-[#eee]">
                <img src="/logo-onepiece.png" alt="ONE PIECE" className="h-[45px] w-auto" />
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full bg-[#f5f5f5]"
                >
                  <XMarkIcon className="size-6 text-[#333]" />
                </button>
              </div>

              <div className="flex-1 px-4 py-10">
                <div className="mx-auto max-w-[600px] flex flex-col gap-6">
                  {NAV_ITEMS.map(item => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={clsx(
                        'group flex items-end gap-4 border-b pb-4 transition-colors',
                        isActive(item.href) ? 'border-[#D9312B]' : 'border-[#eee] hover:border-[#D9312B]',
                      )}
                    >
                      <span className={clsx(
                        'text-xl font-bold group-hover:text-[#D9312B]',
                        isActive(item.href) ? 'text-[#D9312B]' : 'text-[#333]',
                      )}>
                        {item.label}
                      </span>
                      <span className="mb-0.5 text-xs font-bold text-[#999]">{item.sub}</span>
                    </Link>
                  ))}

                  <div className="mt-4 flex flex-col gap-3">
                    <Link
                      href="/cart"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 rounded-full bg-[#D9312B] px-6 py-3 text-sm font-bold text-white hover:bg-[#C62828] transition-colors"
                    >
                      <ShoppingBagIcon className="size-5" />
                      PANIER ({cartCount})
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 rounded-full bg-[#333] px-6 py-3 text-sm font-bold text-white hover:bg-[#D9312B] transition-colors"
                    >
                      <UserCircleIcon className="size-5" />
                      MON COMPTE
                    </Link>
                  </div>
                </div>

                <div className="mt-12 flex flex-col items-center gap-4">
                  <span className="text-xs font-bold tracking-widest text-[#999]">OFFICIAL SNS</span>
                  <div className="flex gap-3">
                    {SNS_ICONS.map(sns => (
                      <a key={sns.id} href={sns.href} className="size-10 rounded-full bg-[#f5f5f5] p-2 flex items-center justify-center">
                        <img src={sns.src} alt={sns.id} className="size-full object-contain" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
