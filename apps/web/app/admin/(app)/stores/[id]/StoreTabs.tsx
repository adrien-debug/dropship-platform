'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, type LucideIcon } from 'lucide-react';

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
  Icon?: LucideIcon;
}

function buildTabs(storeId: string, storeSlug: string): Tab[] {
  return [
    { href: `/admin/stores/${storeId}`, label: 'Aperçu', exact: true },
    { href: `/admin/stores/${storeId}/catalog`, label: 'Catalogue' },
    { href: `/admin/stores/${storeId}/assets`, label: 'Médias' },
    { href: `/admin/stores/${storeId}/analytics`, label: 'Analytics' },
    { href: `/admin/stores/${storeId}/copilot`, label: 'Copilote', Icon: Bot },
    { href: `/admin/stores/${storeId}/settings`, label: 'Réglages' },
    { href: `/shop/${storeSlug}`, label: 'Voir le store ↗' },
  ];
}

export function StoreTabs({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const pathname = usePathname() ?? '';
  const tabs = buildTabs(storeId, storeSlug);

  return (
    <nav className="border-b border-zinc-200 bg-zinc-50 -mx-5 sm:-mx-8 px-5 sm:px-8 sticky top-0 z-10">
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
              className={`relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                active
                  ? 'text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              {tab.Icon && <tab.Icon size={15} strokeWidth={1.75} aria-hidden />}
              {tab.label}
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
