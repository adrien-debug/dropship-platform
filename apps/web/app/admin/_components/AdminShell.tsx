'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutGrid,
  Layers,
  Package,
  LineChart,
  SlidersHorizontal,
  ChevronsRight,
  ChevronsLeft,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AdminLogoutButton } from '../login/AdminLogoutButton';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin',               label: 'Dashboard',     Icon: LayoutGrid,        exact: true },
  { href: '/admin/stores',        label: 'Stores',        Icon: Layers },
  { href: '/admin/orders',        label: 'Commandes',     Icon: Package },
  { href: '/admin/observability', label: 'Observabilité', Icon: LineChart },
  { href: '/admin/settings',      label: 'Réglages',      Icon: SlidersHorizontal },
];

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

function NavList({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 flex flex-col justify-center">
      {!collapsed && (
        <p className="px-4 mb-2 text-kicker uppercase tracking-label text-indigo-300 font-medium">
          Console
        </p>
      )}
      <ul className="space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.Icon;
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={`group relative flex items-center rounded-xl text-sm transition-all duration-150 ${
                  collapsed
                    ? 'justify-center w-12 h-12 mx-auto'
                    : 'gap-3 px-4 py-2.5'
                } ${
                  active
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {active && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 h-5 w-0.5 bg-white rounded-r-full ${
                      collapsed ? '-left-2' : '-left-3'
                    }`}
                    aria-hidden
                  />
                )}
                <Icon size={collapsed ? 22 : 16} strokeWidth={1.5} aria-hidden />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/admin" className="block group" aria-label="Dropship — Dashboard">
      {collapsed ? (
        <span className="block text-3xl font-bold tracking-tight text-white text-center leading-none">
          D<span className="text-indigo-300 group-hover:text-white transition-colors">.</span>
        </span>
      ) : (
        <span className="font-semibold tracking-tight text-xl text-white">
          Dropship<span className="text-indigo-300 group-hover:text-white transition-colors">.</span>
        </span>
      )}
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate collapsed state from localStorage. SSR renders expanded so the
  // first paint matches the most common case; if the user previously
  // collapsed it, we swap on mount (one render flicker is acceptable
  // here — the alternative is a hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Close mobile drawer when route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile drawer is open.
  useEffect(() => {
    if (drawerOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const currentLabel =
    NAV.find((n) =>
      n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + '/'),
    )?.label ?? 'Console';

  return (
    <div className="min-h-screen bg-zinc-100 lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 bg-indigo-600 text-white flex-col sticky top-0 h-screen transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div className={`pt-7 pb-6 ${collapsed ? 'px-2' : 'px-6'}`}>
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <p className="mt-1 text-kicker uppercase tracking-label text-indigo-300 font-medium">
              Production · Agent IA
            </p>
          )}
        </div>
        <NavList pathname={pathname} collapsed={collapsed} />
        <div className={`border-t border-indigo-500 ${collapsed ? 'p-2 space-y-2' : 'p-3 space-y-2'}`}>
          {!collapsed && <AdminLogoutButton />}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Étendre' : 'Réduire'}
            aria-label={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
            className={`flex items-center text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors ${
              collapsed ? 'justify-center w-12 h-12 mx-auto' : 'gap-2 px-3 py-2 text-xs w-full'
            }`}
          >
            {collapsed ? (
              <ChevronsRight size={20} strokeWidth={1.5} aria-hidden />
            ) : (
              <>
                <ChevronsLeft size={16} strokeWidth={1.5} aria-hidden />
                <span>Réduire</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between bg-indigo-600 text-white px-4 py-3 border-b border-indigo-500">
        <Brand collapsed={false} />
        <div className="flex items-center gap-3">
          <span className="text-kicker uppercase tracking-label text-indigo-200 font-medium">
            {currentLabel}
          </span>
          <button
            aria-label="Ouvrir la navigation"
            onClick={() => setDrawerOpen(true)}
            className="p-2 -mr-2 text-indigo-100 hover:text-white"
          >
            <Menu size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <button
            aria-label="Fermer la navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 cursor-default"
          />
          <aside className="relative w-72 max-w-[85vw] bg-indigo-600 text-white flex flex-col admin-drawer-in">
            <div className="px-6 pt-6 pb-5 flex items-center justify-between">
              <Brand collapsed={false} />
              <button
                aria-label="Fermer"
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-indigo-200 hover:text-white"
              >
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <NavList pathname={pathname} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
            <div className="p-3 border-t border-indigo-500">
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
