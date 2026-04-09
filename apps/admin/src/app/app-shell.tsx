'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommandPalette } from '../components/command-palette';

const NAV_SECTIONS = [
  {
    title: 'Commerce',
    items: [
      { href: '/', label: 'Dashboard', icon: '📊', desc: 'Vue d\'ensemble' },
      { href: '/sites', label: 'Shops', icon: '🌐', desc: 'Mes boutiques' },
      { href: '/products', label: 'Products', icon: '🏷️', desc: '20 produits' },
    ],
  },
  {
    title: 'Sourcing',
    items: [
      { href: '/catalogs', label: 'Catalogues', icon: '📦', desc: 'Fournisseurs' },
      { href: '/products/import', label: 'Import', icon: '📥', desc: 'Importer produits' },
      { href: '/catalog-validator', label: 'Trending 2026', icon: '✅', desc: 'Top 20 validés' },
    ],
  },
  {
    title: 'Découverte',
    items: [
      { href: '/discover', label: 'Discover', icon: '🔥', desc: 'Tendances' },
      { href: '/marketing', label: 'Marketing', icon: '📣', desc: 'Google & Meta' },
      { href: '/agents', label: 'AI Agent', icon: '🤖', desc: 'Pipeline A-Z' },
    ],
  },
  {
    title: 'Outils',
    items: [
      { href: '/launcher', label: 'Launcher', icon: '🚀', desc: 'Codegen & deploy' },
      { href: '/sites/batch', label: 'Batch', icon: '🏭', desc: 'Création en masse' },
      { href: '/pipeline', label: 'Pipeline', icon: '🚦', desc: 'Health services' },
    ],
  },
  {
    title: 'Système',
    items: [
      { href: '/gpu', label: 'GPU Status', icon: '🖥️', desc: 'Serveurs' },
      { href: '/settings', label: 'Settings', icon: '⚙️', desc: 'Configuration' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <Sidebar pathname={pathname} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (collapsed) {
    return (
      <aside className="flex w-16 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center justify-center border-b">
          <button onClick={() => setCollapsed(false)} className="text-lg" title="Ouvrir le menu">
            ☰
          </button>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 py-3">
          {NAV_SECTIONS.flatMap(s => s.items).map(link => (
            <a
              key={link.href}
              href={link.href}
              title={link.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition ${
                isActive(link.href)
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {link.icon}
            </a>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center justify-between border-b px-5">
        <h1 className="text-base font-bold text-gray-900">Dropship Platform</h1>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Réduire"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400 transition hover:bg-gray-100"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="rounded border bg-white px-1 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map(section => (
          <div key={section.title} className="mb-4">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {section.items.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-center transition ${
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
