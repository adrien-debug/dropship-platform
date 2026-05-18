'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  COCKPIT_NAV_ACTIONS,
  COCKPIT_STORE_TABS,
  type IconName,
  type BottomBarSegment as NavSegment,
  type StoreTab,
} from '@/components/cockpit/nav.config';

// ── Icon lookup ───────────────────────────────────────────────────────────────

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

function NavIcon({ name, size = 12 }: { name: IconName; size?: number }) {
  const Icon = ICON_MAP[name] ?? LayoutGrid;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

// ── Store context detection ───────────────────────────────────────────────────

/**
 * Extracts the storeId segment from `/admin/stores/[id]/...` pathnames.
 * Returns null if the current page is not inside a store context.
 */
function extractStoreId(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/stores\/([^/]+)(?:\/|$)/);
  if (!match) return null;
  const segment = match[1];
  // Exclude the "new" page — it's not a real store context.
  if (segment === 'new') return null;
  return segment;
}

// ── Segment button ────────────────────────────────────────────────────────────

interface SegBtnProps {
  href: string;
  label: string;
  icon?: IconName;
  active: boolean;
  primary?: boolean;
  target?: '_blank';
}

function SegBtn({ href, label, icon, active, primary, target }: SegBtnProps) {
  const cls = [
    'ct-seg-btn',
    active ? 'active' : '',
    primary ? 'primary' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link
      href={href}
      className={cls}
      role="tab"
      aria-selected={active}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {icon && <NavIcon name={icon} size={12} />}
      {label}
    </Link>
  );
}

// ── BottomBar ─────────────────────────────────────────────────────────────────

/**
 * BottomBar — floating pill at the bottom of the CenterPanel.
 *
 * Always renders:
 *   - COCKPIT_NAV_ACTIONS: "Nouveau store" CTA (primary variant)
 *
 * Renders contextually (only inside /admin/stores/[id]):
 *   - COCKPIT_STORE_TABS: 7 store sub-page tabs (with interpolated storeId/storeSlug)
 *
 * Active state is derived from usePathname() — zero props needed.
 */
export default function BottomBar() {
  const pathname = usePathname() ?? '';
  const storeId = extractStoreId(pathname);
  const isStoreContext = storeId !== null;

  // ── Resolve active state for a NavSegment (global actions) ──
  function isActionActive(seg: NavSegment): boolean {
    if (seg.exact) return pathname === seg.route;
    return pathname === seg.route || pathname.startsWith(seg.route + '/');
  }

  // ── Resolve a store tab route (interpolate [id] and [slug]) ──
  function resolveTabRoute(tab: StoreTab): string {
    if (!storeId) return tab.routePattern;
    // For external storefront link, use storeId as slug (works if URL uses slug).
    // For admin routes, use storeId as the [id] segment.
    return tab.routePattern
      .replace('[id]', storeId)
      .replace('[slug]', storeId);
  }

  // ── Resolve active state for a StoreTab ──
  function isTabActive(tab: StoreTab): boolean {
    // External link is never "active".
    if (tab.target === '_blank') return false;
    const route = resolveTabRoute(tab);
    if (tab.exact) return pathname === route;
    return pathname === route || pathname.startsWith(route + '/');
  }

  const sortedActions = [...COCKPIT_NAV_ACTIONS].sort((a, b) => a.order - b.order);
  const sortedTabs = [...COCKPIT_STORE_TABS].sort((a, b) => a.order - b.order);

  return (
    <div className="ct-bottom-bar" role="navigation" aria-label="Navigation rapide">
      <div className="ct-bottom-bar-inner">
        {/* Store tabs — contextual (only inside /admin/stores/[id]) */}
        {isStoreContext && (
          <div className="ct-seg-track" role="tablist" aria-label="Onglets du store">
            {sortedTabs.map((tab) => (
              <SegBtn
                key={tab.id}
                href={resolveTabRoute(tab)}
                label={tab.label}
                icon={tab.icon}
                active={isTabActive(tab)}
                target={tab.target}
              />
            ))}
          </div>
        )}

        {/* Global actions — always visible */}
        <div className="ct-seg-track" role="group" aria-label="Actions globales">
          {sortedActions.map((action) => (
            <SegBtn
              key={action.id}
              href={action.route}
              label={action.label}
              icon={action.icon}
              active={isActionActive(action)}
              primary={action.variant === 'primary'}
              target={action.target}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
