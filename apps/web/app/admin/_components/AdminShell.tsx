'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminLogoutButton } from '../login/AdminLogoutButton';

const NAV = [
  { href: '/admin/stores', label: 'Stores' },
  { href: '/admin/orders', label: 'Commandes' },
  { href: '/admin/catalog', label: 'Catalogue' },
  { href: '/admin/generated', label: 'Médias' },
  { href: '/admin/settings', label: 'Réglages' },
];

function MenuIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3">
      <p className="px-4 mb-2 text-kicker uppercase tracking-label text-zinc-600 font-medium">
        Console
      </p>
      <ul className="space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`group relative flex items-center px-4 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-zinc-800/80 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {active && (
                  <span
                    className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-white rounded-r-full"
                    aria-hidden
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin/stores" className="block group">
      <span className="font-serif text-xl text-white tracking-tight">
        Dropship<span className="text-zinc-500 group-hover:text-white/80 transition-colors">.</span>
      </span>
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);

  // Close drawer when route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  const currentLabel = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Console';

  return (
    <div className="min-h-screen bg-zinc-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-zinc-950 text-white flex-col sticky top-0 h-screen">
        <div className="px-6 pt-7 pb-6">
          <Brand />
          <p className="mt-1 text-kicker uppercase tracking-label text-zinc-600 font-medium">
            Production · Agent IA
          </p>
        </div>
        <NavList pathname={pathname} />
        <div className="p-3 border-t border-zinc-900">
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between bg-zinc-950 text-white px-4 py-3 border-b border-zinc-900">
        <Brand />
        <div className="flex items-center gap-3">
          <span className="text-kicker uppercase tracking-label text-zinc-500 font-medium">
            {currentLabel}
          </span>
          <button
            aria-label="Ouvrir la navigation"
            onClick={() => setOpen(true)}
            className="p-2 -mr-2 text-zinc-200 hover:text-white"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <button
            aria-label="Fermer la navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 cursor-default"
          />
          <aside className="relative w-72 max-w-[85vw] bg-zinc-950 text-white flex flex-col admin-drawer-in">
            <div className="px-6 pt-6 pb-5 flex items-center justify-between">
              <Brand />
              <button
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 text-zinc-400 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="p-3 border-t border-zinc-900">
              <AdminLogoutButton />
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
