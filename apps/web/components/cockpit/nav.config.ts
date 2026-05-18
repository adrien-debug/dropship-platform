/**
 * nav.config.ts — Cockpit navigation data (pure data, no JSX, no components).
 *
 * Consumed by:
 *   - RailLeft.tsx  (Agent 3): renders COCKPIT_NAV_MAIN + logout avatar
 *   - BottomBar.tsx (Agent 3): renders COCKPIT_NAV_ACTIONS + COCKPIT_STORE_TABS (contextual)
 *
 * Icons are string identifiers (Lucide icon names). The rendering layer
 * imports the actual Lucide component via a lookup map — do not import
 * Lucide here to keep this file a pure data module.
 *
 * All 15 original items are preserved (7 dock + logout + 7 store tabs).
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Lucide icon name (string identifier, resolved by the rendering layer). */
export type IconName =
  | 'LayoutGrid'
  | 'Layers'
  | 'ShoppingBag'
  | 'LineChart'
  | 'Palette'
  | 'Cog'
  | 'LogOut'
  | 'Sparkles'
  | 'LayoutDashboard'
  | 'Package'
  | 'Image'
  | 'BarChart2'
  | 'Bot'
  | 'SlidersHorizontal'
  | 'ExternalLink';

/** A rail-left navigation item (icon only, tooltip on hover). */
export interface RailNavItem {
  /** Unique identifier. */
  id: string;
  /** Tooltip shown on hover (also used as aria-label). */
  label: string;
  /** Destination route. Null for action-only items (e.g. logout). */
  route: string | null;
  /** Lucide icon name. */
  icon: IconName;
  /** Display order (ascending). */
  order: number;
  /**
   * Navigation group:
   *   'main'   — vertical nav links (top cluster of the rail)
   *   'avatar' — rendered in the avatar slot at the bottom (e.g. logout)
   */
  group: 'main' | 'avatar';
  /** When true, active state only matches the exact pathname. */
  exact?: boolean;
  /** For 'avatar' items: side-effect to trigger on click (no route nav). */
  action?: 'logout-cookie';
}

/** A bottom-bar segment button (label + optional icon). */
export interface BottomBarSegment {
  /** Unique identifier. */
  id: string;
  /** Visible label in the pill segment. */
  label: string;
  /** Destination route. */
  route: string;
  /** Lucide icon name (optional for bottom-bar segments). */
  icon?: IconName;
  /** Display order (ascending). */
  order: number;
  /**
   * Visual variant:
   *   'default' — standard muted segment (ct-seg-btn)
   *   'primary' — accent white CTA (ct-seg-btn.primary)
   */
  variant?: 'default' | 'primary';
  /** Link target attribute (e.g. '_blank' for external storefront link). */
  target?: '_blank';
  /** When true, active state only matches the exact pathname. */
  exact?: boolean;
}

/** A store-contextual tab (shown in bottom-bar when inside /admin/stores/[id]). */
export interface StoreTab {
  /** Unique identifier. */
  id: string;
  /** Visible label in the pill segment. */
  label: string;
  /**
   * Route pattern. The rendering layer replaces '[id]' with the live
   * storeId and '[slug]' with the live storeSlug.
   */
  routePattern: string;
  /** Lucide icon name. */
  icon: IconName;
  /** Display order (ascending). */
  order: number;
  /** When true, active state only matches the exact pathname. */
  exact?: boolean;
  /** Link target attribute. */
  target?: '_blank';
}

// ─────────────────────────────────────────────
// COCKPIT_NAV_MAIN
// Rail-left navigation items (main cluster, top → bottom).
// Logout is included here with group='avatar' — the rendering layer
// places it in the avatar slot at the bottom of the rail.
// ─────────────────────────────────────────────

export const COCKPIT_NAV_MAIN: readonly RailNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    route: '/admin',
    icon: 'LayoutGrid',
    order: 1,
    group: 'main',
    exact: true,
  },
  {
    id: 'stores',
    label: 'Stores',
    route: '/admin/stores',
    icon: 'Layers',
    order: 2,
    group: 'main',
    exact: false,
  },
  {
    id: 'orders',
    label: 'Commandes',
    route: '/admin/orders',
    icon: 'ShoppingBag',
    order: 3,
    group: 'main',
    exact: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    route: '/admin/observability',
    icon: 'LineChart',
    order: 4,
    group: 'main',
    exact: false,
  },
  {
    id: 'templates',
    label: 'Templates',
    route: '/admin/templates',
    icon: 'Palette',
    order: 5,
    group: 'main',
    exact: false,
  },
  {
    id: 'settings',
    label: 'Réglages',
    route: '/admin/settings',
    icon: 'Cog',
    order: 6,
    group: 'main',
    exact: false,
  },
  {
    id: 'logout',
    label: 'Déconnexion',
    route: null,
    icon: 'LogOut',
    order: 99,
    group: 'avatar',
    action: 'logout-cookie',
    // Rendering note: onClick handler must clear cookie admin_session then
    // redirect to /admin. Logic lives in the rendering component, not here.
  },
] as const;

// ─────────────────────────────────────────────
// COCKPIT_NAV_ACTIONS
// Bottom-bar global action segments — always visible regardless of page.
// Currently one item: the primary CTA "Nouveau store".
// ─────────────────────────────────────────────

export const COCKPIT_NAV_ACTIONS: readonly BottomBarSegment[] = [
  {
    id: 'new-store',
    label: 'Nouveau store',
    route: '/admin/stores/new',
    icon: 'Sparkles',
    order: 1,
    variant: 'primary',
    // ct-seg-btn.primary — white accent pill, always visible
  },
] as const;

// ─────────────────────────────────────────────
// COCKPIT_STORE_TABS
// Bottom-bar contextual segments shown when pathname is inside
// /admin/stores/[id].
//
// The rendering layer (BottomBar.tsx) must:
//   1. Detect context: pathname.startsWith('/admin/stores/') && storeId exists
//   2. Interpolate routePattern: replace '[id]' with storeId, '[slug]' with storeSlug
//   3. Derive active state per tab (exact match or prefix match)
//   4. Render a second ct-seg-track beside COCKPIT_NAV_ACTIONS
//
// The storeId and storeSlug values come from URL params / page context,
// not from this config file.
// ─────────────────────────────────────────────

export const COCKPIT_STORE_TABS: readonly StoreTab[] = [
  {
    id: 'store-overview',
    label: 'Aperçu',
    routePattern: '/admin/stores/[id]',
    icon: 'LayoutDashboard',
    order: 1,
    exact: true,
  },
  {
    id: 'store-catalog',
    label: 'Catalogue',
    routePattern: '/admin/stores/[id]/catalog',
    icon: 'Package',
    order: 2,
    exact: false,
  },
  {
    id: 'store-assets',
    label: 'Médias',
    routePattern: '/admin/stores/[id]/assets',
    icon: 'Image',
    order: 3,
    exact: false,
  },
  {
    id: 'store-analytics',
    label: 'Analytics',
    routePattern: '/admin/stores/[id]/analytics',
    icon: 'BarChart2',
    order: 4,
    exact: false,
  },
  {
    id: 'store-copilot',
    label: 'Copilote',
    routePattern: '/admin/stores/[id]/copilot',
    icon: 'Bot',
    order: 5,
    exact: false,
  },
  {
    id: 'store-settings',
    label: 'Réglages',
    routePattern: '/admin/stores/[id]/settings',
    icon: 'SlidersHorizontal',
    order: 6,
    exact: false,
  },
  {
    id: 'store-visit',
    label: 'Voir le store',
    routePattern: '/shop/[slug]',
    icon: 'ExternalLink',
    order: 7,
    exact: false,
    target: '_blank',
    // External link — opens the live storefront. Never active (external).
    // Rendering note: isActive must always return false for this tab.
  },
] as const;
