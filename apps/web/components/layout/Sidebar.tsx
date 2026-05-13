'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { NAV_SECTIONS, isNavActive } from '@/lib/design-system/navigation';

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

export function Sidebar() {
  const pathname = usePathname() ?? '/admin';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved === '0') setCollapsed(false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const logout = () => {
    document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/admin';
  };

  const activeSection = NAV_SECTIONS.find((s) => isNavActive(s, pathname));

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          'hidden lg:flex shrink-0 flex-col h-full',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'bg-ds-bg-sidebar border-r border-ds-border-subtle',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'shrink-0 flex items-center h-[56px]',
            collapsed ? 'justify-center px-2' : 'px-5',
          )}
        >
          <Link href="/admin" className="block group" aria-label="Dropship — Dashboard">
            {collapsed ? (
              <span className="text-xl font-bold tracking-tight text-ds-text-primary">
                D<span className="text-ds-text-muted">.</span>
              </span>
            ) : (
              <span className="font-semibold tracking-tight text-lg text-ds-text-primary">
                Dropship<span className="text-ds-text-muted">.</span>
              </span>
            )}
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-ds-border-subtle" />

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col px-2.5 py-4 gap-0.5">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = isNavActive(section, pathname);
            return (
              <Link
                key={section.id}
                href={section.href}
                title={collapsed ? section.label : undefined}
                aria-label={section.label}
                className={cn(
                  'group relative flex items-center rounded-[10px] transition-all duration-200',
                  collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3.5 py-2.5',
                  active
                    ? 'bg-ds-surface-elevated text-[var(--accent-cyan)]'
                    : 'text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-default',
                  active && 'border border-[var(--border-accent)] shadow-[0_0_12px_rgba(0,183,255,0.08)]',
                  !active && 'border border-transparent',
                )}
              >
                {/* Active indicator */}
                {active && (
                  <span
                    className={cn(
                      'absolute bg-[var(--accent-cyan)] rounded-full shadow-glow',
                      collapsed
                        ? '-right-0.5 top-1/2 -translate-y-1/2 w-1 h-1'
                        : 'left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full',
                    )}
                    aria-hidden
                  />
                )}
                <Icon
                  size={collapsed ? 20 : 18}
                  strokeWidth={active ? 2 : 1.5}
                  aria-hidden
                />
                {!collapsed && (
                  <span className={cn('text-sm font-medium', active && 'text-ds-text-primary')}>
                    {section.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="shrink-0 p-2.5 border-t border-ds-border-subtle space-y-1 mt-auto">
          {/* Logout */}
          <button
            type="button"
            onClick={logout}
            className={cn(
              'flex items-center text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-default rounded-[10px] transition-all duration-200',
              collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3.5 py-2.5 text-xs w-full',
            )}
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut size={collapsed ? 18 : 15} strokeWidth={1.5} aria-hidden />
            {!collapsed && <span className="font-medium">Déconnexion</span>}
          </button>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Étendre' : 'Réduire'}
            aria-label={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
            className={cn(
              'flex items-center text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-default rounded-[10px] transition-all duration-200',
              collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-2.5 px-3.5 py-2.5 text-xs w-full',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.5} aria-hidden />
            ) : (
              <>
                <PanelLeftClose size={15} strokeWidth={1.5} aria-hidden />
                <span className="font-medium">Réduire</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Topbar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between h-[56px] px-4 bg-ds-bg-sidebar border-b border-ds-border-subtle">
        <Link href="/admin" className="font-semibold tracking-tight text-lg text-ds-text-primary">
          Dropship<span className="text-ds-text-muted">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.15em] text-ds-text-muted font-semibold">
            {activeSection?.label ?? 'Console'}
          </span>
          <button
            aria-label="Ouvrir la navigation"
            onClick={() => setDrawerOpen(true)}
            className="p-2 -mr-2 text-ds-text-secondary hover:text-ds-text-primary transition-colors"
          >
            <Menu size={22} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button
            aria-label="Fermer la navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 cursor-default"
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-ds-bg-sidebar border-r border-ds-border-subtle flex flex-col admin-drawer-in">
            <div className="px-5 h-[56px] flex items-center justify-between shrink-0">
              <span className="font-semibold tracking-tight text-lg text-ds-text-primary">
                Dropship<span className="text-ds-text-muted">.</span>
              </span>
              <button
                aria-label="Fermer"
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 text-ds-text-muted hover:text-ds-text-primary transition-colors"
              >
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <div className="mx-4 h-px bg-ds-border-subtle" />

            <nav className="flex-1 flex flex-col px-3 py-4 gap-0.5">
              {NAV_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = isNavActive(section, pathname);
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm font-medium transition-all',
                      active
                        ? 'bg-ds-surface-elevated text-[var(--accent-cyan)] border-glow'
                        : 'text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-default',
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} aria-hidden />
                    {section.label}
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 p-3 border-t border-ds-border-subtle">
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-default rounded-[10px] transition-colors w-full font-medium"
              >
                <LogOut size={15} strokeWidth={1.5} aria-hidden />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile content offset */}
      {!mounted && <div className="lg:hidden h-[56px] shrink-0" />}
    </>
  );
}
