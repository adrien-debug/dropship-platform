/**
 * Navigation configuration — single source of truth.
 *
 * Defines all admin sections, their routes, icons, and panel content.
 * The UI derives everything from this config:
 *   - sidebar items
 *   - active state
 *   - left panel content
 *   - right panel content
 */

import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Activity,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// ── Types ──

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  exact?: boolean;
  /** Whether this section has a contextual left panel */
  hasLeftPanel: boolean;
  /** Whether this section has a contextual right panel */
  hasRightPanel: boolean;
  /** Whether this section shows the central chat */
  hasChat: boolean;
  /** Optional description for tooltips */
  description?: string;
}

export interface NavConfig {
  sections: NavSection[];
  /** Fallback when no section matches */
  defaultSectionId: string;
}

// ── Navigation sections ──

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin',
    exact: true,
    hasLeftPanel: true,
    hasRightPanel: true,
    hasChat: false,
    description: 'Vue d\'ensemble du portfolio',
  },
  {
    id: 'stores',
    label: 'Stores',
    icon: Store,
    href: '/admin/stores',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasChat: false,
    description: 'Gestion des stores',
  },
  {
    id: 'orders',
    label: 'Commandes',
    icon: ShoppingCart,
    href: '/admin/orders',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasChat: false,
    description: 'Suivi des commandes et forwards',
  },
  {
    id: 'observability',
    label: 'Observabilité',
    icon: Activity,
    href: '/admin/observability',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasChat: false,
    description: 'Métriques et coûts IA',
  },
  {
    id: 'settings',
    label: 'Réglages',
    icon: Settings,
    href: '/admin/settings',
    hasLeftPanel: true,
    hasRightPanel: true,
    hasChat: false,
    description: 'Configuration de la plateforme',
  },
];

export const NAV_CONFIG: NavConfig = {
  sections: NAV_SECTIONS,
  defaultSectionId: 'dashboard',
};

// ── Resolvers ──

/**
 * Find the active section from a pathname.
 */
export function resolveActiveSection(pathname: string): NavSection | undefined {
  // Sort by length descending so /admin/stores matches before /admin
  const sorted = [...NAV_SECTIONS].sort((a, b) => b.href.length - a.href.length);

  for (const section of sorted) {
    if (section.exact) {
      if (pathname === section.href) return section;
    } else {
      if (pathname === section.href || pathname.startsWith(section.href + '/')) {
        return section;
      }
    }
  }

  return undefined;
}

/**
 * Check if a nav item is active for a given pathname.
 */
export function isNavActive(section: NavSection, pathname: string): boolean {
  if (section.exact) {
    return pathname === section.href;
  }
  return pathname === section.href || pathname.startsWith(section.href + '/');
}

/**
 * Get the section by ID.
 */
export function getSectionById(id: string): NavSection | undefined {
  return NAV_SECTIONS.find((s) => s.id === id);
}
