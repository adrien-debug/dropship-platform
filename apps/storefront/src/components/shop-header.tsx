'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCart } from '@/context/cart-context';

const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: '#featured', label: 'Shop' },
  { href: '#categories', label: 'Categories' },
  { href: '#new-arrivals', label: 'New Arrivals' },
  { href: '#newsletter', label: 'Newsletter' },
];

function CartIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 6h15l-1.5 9h-12L6 6zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20a1 1 0 102 0 1 1 0 00-2 0zm8 0a1 1 0 102 0 1 1 0 00-2 0z"
        fill="currentColor"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ShopHeader(): React.JSX.Element {
  const { items } = useCart();
  const itemCount = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');

  const badgeLabel = useMemo(() => {
    if (itemCount > 99) return '99+';
    return String(itemCount);
  }, [itemCount]);

  return (
    <header className="sticky top-0 z-50 border-b border-op-brand/15 bg-op-cream/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-op-brand bg-op-card shadow-sm">
            <Image
              src="https://picsum.photos/seed/onepeace-logo/160/160"
              alt="One Peace mark"
              width={160}
              height={160}
              className="h-full w-full object-cover"
              sizes="40px"
              priority
            />
          </span>
          <span className="font-display text-xl tracking-wide text-op-ink sm:text-2xl">One Peace</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-op-muted transition hover:text-op-brand"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:gap-3 md:flex-none md:gap-4">
          <label className="relative hidden min-w-[12rem] flex-1 md:block lg:min-w-[16rem]">
            <span className="sr-only">Search products</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-op-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gear..."
              className={clsx(
                'w-full rounded-full border border-op-brand/20 bg-op-card py-2 pl-10 pr-4 text-sm text-op-ink',
                'placeholder:text-op-muted/80 outline-none ring-op-brand/30 focus:border-op-brand focus:ring-2',
              )}
            />
          </label>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-brand/20 bg-op-card text-op-ink md:hidden"
            aria-label="Open search"
            onClick={() => {
              const q = window.prompt('Search', query);
              if (q !== null) setQuery(q);
            }}
          >
            <SearchIcon className="h-5 w-5" />
          </button>

          <Link
            href="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-brand/20 bg-op-card text-op-ink transition hover:border-op-brand/40"
            aria-label={`Shopping cart, ${itemCount} items`}
          >
            <CartIcon className="h-5 w-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-op-brand px-1 text-[10px] font-bold text-op-cream">
                {badgeLabel}
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-brand/20 bg-op-card text-op-ink md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} className="relative z-[60] md:hidden">
        <div className="fixed inset-0 bg-op-ink/40 backdrop-blur-sm" aria-hidden />
        <div className="fixed inset-0 flex items-start justify-end p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl border border-op-brand/20 bg-op-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="font-display text-lg text-op-ink">Navigate</DialogTitle>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-op-brand/20 text-op-ink"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-3 text-sm font-semibold text-op-ink hover:bg-op-cream"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </DialogPanel>
        </div>
      </Dialog>
    </header>
  );
}
