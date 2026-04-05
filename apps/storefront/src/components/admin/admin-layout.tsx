'use client';

import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  ChartBarIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: 'Vue d’ensemble', icon: Squares2X2Icon },
  { href: '/admin/products', label: 'Produits', icon: ShoppingBagIcon },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingCartIcon },
  { href: '/admin/customers', label: 'Clients', icon: UserGroupIcon },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
] as const;

function navActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[color:var(--dashboard-page)]">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-surface)] transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[color:var(--dashboard-border)] px-4 lg:justify-start">
          <span className="font-semibold text-[color:var(--dashboard-text-bright)]">One Peace</span>
          <button
            type="button"
            className="rounded-md p-1 text-[color:var(--dashboard-text-muted)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = navActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 rounded-[var(--dashboard-radius-input)] px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]'
                    : 'text-[color:var(--dashboard-text-secondary)] hover:bg-[color:var(--dashboard-overlay-05)] hover:text-[color:var(--dashboard-text-primary)]',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[color:var(--dashboard-overlay-dark-30)] lg:hidden"
          aria-label="Fermer"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-page)]/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1 text-[color:var(--dashboard-text-muted)] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <span className="text-sm text-[color:var(--dashboard-text-secondary)]">Administration</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[200px] truncate text-xs text-[color:var(--dashboard-text-muted)] sm:inline">
              {session?.user?.email}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="inline-flex items-center gap-1.5 rounded-[var(--dashboard-radius-button)] border border-[color:var(--dashboard-border-mid)] px-3 py-1.5 text-xs font-medium text-[color:var(--dashboard-text-primary)] hover:bg-[color:var(--dashboard-overlay-05)]"
            >
              <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
