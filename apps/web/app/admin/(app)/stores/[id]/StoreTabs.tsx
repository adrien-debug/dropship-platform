'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sticky tab navigation for the per-store admin area. Renders the same
 * tab set on every sub-page (catalog, media, ads, curate, analytics,
 * domain, overview) so the operator never loses orientation when drilling
 * in. Active state is derived from the live pathname.
 *
 * Visual: Linear/Stripe-style underlined tabs that scroll horizontally on
 * narrow viewports.
 */

interface Tab {
  href: string;
  label: string;
  exact?: boolean;
  /** When set, renders a small uppercase badge next to the label. */
  badge?: string;
}

function buildTabs(storeId: string, storeSlug: string): Tab[] {
  return [
    { href: `/admin/stores/${storeId}`, label: 'Aperçu', exact: true },
    { href: `/admin/stores/${storeId}/catalog`, label: 'Catalogue' },
    { href: `/admin/stores/${storeId}/assets`, label: 'Médias' },
    { href: `/admin/stores/${storeId}/curate`, label: 'Curation' },
    { href: `/admin/stores/${storeId}/ads`, label: 'Ads' },
    { href: `/admin/stores/${storeId}/analytics`, label: 'Analytics' },
    // Copilote hub — flagship unified chat with research/curation/ads/medias/dev.
    // Placed between Analytics and Réglages so the operator finds it at the
    // end of the workflow surfaces but before settings.
    { href: `/admin/stores/${storeId}/copilot`, label: '🤖 Copilote', badge: 'new' },
    { href: `/admin/stores/${storeId}/settings`, label: 'Réglages' },
    { href: `/shop/${storeSlug}`, label: 'Voir le store ↗' },
  ];
}

export function StoreTabs({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const pathname = usePathname() ?? '';
  const tabs = buildTabs(storeId, storeSlug);

  return (
    <nav className="border-b border-zinc-200 bg-white -mx-5 sm:-mx-8 px-5 sm:px-8 sticky top-0 z-10">
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isExternal = tab.href.startsWith('/shop/');
          const active = isExternal
            ? false
            : tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              target={isExternal ? '_blank' : undefined}
              className={`relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded-sm bg-amber-100 text-amber-700 align-middle">
                  {tab.badge}
                </span>
              )}
              {active && (
                <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-zinc-900" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
