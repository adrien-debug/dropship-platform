'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart2,
  Package,
  SlidersHorizontal,
  Bot,
  Image,
  type LucideIcon,
} from 'lucide-react';

// ── Tab definitions ───────────────────────────────────────────────────────────

interface StoreTab {
  id: string;
  label: string;
  /** Route with [id] placeholder replaced by storeId at render time. */
  routePattern: string;
  Icon: LucideIcon;
  /** When true, active only on exact pathname match. */
  exact?: boolean;
}

const STORE_TABS: readonly StoreTab[] = [
  {
    id: 'overview',
    label: 'Détails',
    routePattern: '/admin/stores/[id]',
    Icon: LayoutDashboard,
    exact: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    routePattern: '/admin/stores/[id]/analytics',
    Icon: BarChart2,
  },
  {
    id: 'catalog',
    label: 'Catalogue',
    routePattern: '/admin/stores/[id]/catalog',
    Icon: Package,
  },
  {
    id: 'settings',
    label: 'Réglages',
    routePattern: '/admin/stores/[id]/settings',
    Icon: SlidersHorizontal,
  },
  {
    id: 'copilot',
    label: 'Copilote',
    routePattern: '/admin/stores/[id]/copilot',
    Icon: Bot,
  },
  {
    id: 'assets',
    label: 'Médias',
    routePattern: '/admin/stores/[id]/assets',
    Icon: Image,
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface StoreTabsBarProps {
  storeId: string;
}

export function StoreTabsBar({ storeId }: StoreTabsBarProps) {
  const pathname = usePathname() ?? '';

  function resolveRoute(tab: StoreTab): string {
    return tab.routePattern.replace('[id]', storeId);
  }

  function isActive(tab: StoreTab): boolean {
    const route = resolveRoute(tab);
    if (tab.exact) return pathname === route;
    return pathname === route || pathname.startsWith(route + '/');
  }

  return (
    <nav
      role="tablist"
      aria-label="Onglets du store"
      style={{
        display: 'flex',
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: 'var(--ct-surface-2)',
        border: '1px solid var(--ct-border)',
        flexShrink: 0,
      }}
    >
      {STORE_TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.id}
            href={resolveRoute(tab)}
            role="tab"
            aria-selected={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 13,
              textDecoration: 'none',
              transition: 'background var(--ct-dur-base), color var(--ct-dur-base)',
              background: active ? 'var(--ct-surface-3)' : 'transparent',
              color: active ? 'var(--ct-text-primary)' : 'var(--ct-text-muted)',
              fontWeight: active ? 600 : 400,
            }}
          >
            <tab.Icon size={13} strokeWidth={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
