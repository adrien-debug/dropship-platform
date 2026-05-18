'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Layers,
  ShoppingBag,
  LineChart,
  Palette,
  Cog,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Package,
  Image,
  BarChart2,
  Bot,
  SlidersHorizontal,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';

import {
  COCKPIT_NAV_MAIN,
  type IconName,
} from '@/components/cockpit/nav.config';

// ── Icon lookup map (Lucide → component) ─────────────────────────────────────

const ICON_MAP: Record<IconName, LucideIcon> = {
  LayoutGrid,
  Layers,
  ShoppingBag,
  LineChart,
  Palette,
  Cog,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Package,
  Image,
  BarChart2,
  Bot,
  SlidersHorizontal,
  ExternalLink,
};

const ICON_NAV = 18;
const ICON_AVATAR = 16;

function NavIcon({ name, size = ICON_NAV }: { name: IconName; size?: number }) {
  const Icon = ICON_MAP[name] ?? LayoutGrid;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

// ── Logout helper (mirrors original AdminShell FloatingDock behaviour) ────────

function handleLogout() {
  // Clear the admin_session cookie (Basic Auth session hint).
  document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  // Force a hard navigation so the browser drops cached Basic Auth credentials.
  window.location.href = '/admin';
}

// ── RailLeft ──────────────────────────────────────────────────────────────────

/**
 * RailLeft — 88px fixed rail.
 * Reads COCKPIT_NAV_MAIN from nav.config to render:
 *   - Logo slot (top)
 *   - Main nav items (group='main') — icon-only, tooltip on hover, active via usePathname()
 *   - Spacer
 *   - Avatar / logout slot (group='avatar') — click to logout
 */
export default function RailLeft() {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const mainItems = COCKPIT_NAV_MAIN.filter((item) => item.group === 'main');
  const avatarItem = COCKPIT_NAV_MAIN.find((item) => item.group === 'avatar');

  function isActive(route: string | null, exact = false): boolean {
    if (!route) return false;
    if (exact) return pathname === route;
    return pathname === route || pathname.startsWith(route + '/');
  }

  function handleNavClick(route: string | null) {
    if (route) router.push(route);
  }

  return (
    <aside className="ct-rail-left">
      {/* Logo */}
      <a href="/admin" className="ct-logo-slot" aria-label="Accueil">
        <div className="ct-logo-dot" />
      </a>

      {/* Main navigation */}
      <nav
        aria-label="Navigation principale"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}
      >
        {mainItems.map((item) => {
          const active = isActive(item.route, item.exact);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.route)}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 'var(--ct-radius-nav)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--ct-accent-soft)' : 'transparent',
                color: active ? 'var(--ct-accent-strong)' : 'var(--ct-text-muted)',
                outline: active ? '1px solid var(--ct-border-accent)' : 'none',
                transition: `background var(--ct-dur-base) var(--ct-ease), color var(--ct-dur-base) var(--ct-ease)`,
              }}
            >
              <NavIcon name={item.icon} size={ICON_NAV} />
            </button>
          );
        })}
      </nav>

      <div className="ct-spacer" />

      {/* Avatar / Logout slot */}
      {avatarItem ? (
        <button
          type="button"
          className="ct-avatar"
          onClick={handleLogout}
          aria-label={avatarItem.label}
          title={avatarItem.label}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <NavIcon name={avatarItem.icon} size={ICON_AVATAR} />
        </button>
      ) : (
        <div className="ct-avatar" aria-label="Utilisateur">
          AB
        </div>
      )}
    </aside>
  );
}
