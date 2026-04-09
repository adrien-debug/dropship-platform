'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Action {
  id: string;
  label: string;
  description?: string;
  icon: string;
  section: 'navigation' | 'action' | 'search' | 'create';
  handler: () => void | Promise<void>;
}

const NAV_ITEMS: Omit<Action, 'handler'>[] = [
  { id: 'nav-home', label: 'Dashboard', icon: '📊', section: 'navigation' },
  { id: 'nav-sites', label: 'Shops', icon: '🌐', section: 'navigation' },
  { id: 'nav-catalogs', label: 'Catalogs', icon: '📦', section: 'navigation' },
  { id: 'nav-products', label: 'Products', icon: '🏷️', section: 'navigation' },
  { id: 'nav-marketing', label: 'Marketing', icon: '📣', section: 'navigation' },
  { id: 'nav-discover', label: 'Discover', icon: '🔥', section: 'navigation' },
  { id: 'nav-agents', label: 'AI Agent', icon: '🤖', section: 'navigation' },
  { id: 'nav-pipeline', label: 'Pipeline Health', icon: '🚦', section: 'navigation' },
  { id: 'nav-gpu', label: 'GPU Status', icon: '🖥️', section: 'navigation' },
  { id: 'nav-settings', label: 'Settings', icon: '⚙️', section: 'navigation' },
  { id: 'nav-launcher', label: 'Launcher', icon: '🚀', section: 'navigation' },
];

const NAV_PATHS: Record<string, string> = {
  'nav-home': '/',
  'nav-sites': '/sites',
  'nav-catalogs': '/catalogs',
  'nav-products': '/products',
  'nav-marketing': '/marketing',
  'nav-discover': '/discover',
  'nav-agents': '/agents',
  'nav-pipeline': '/pipeline',
  'nav-gpu': '/gpu',
  'nav-settings': '/settings',
  'nav-launcher': '/launcher',
};

const SECTION_LABELS: Record<string, string> = {
  create: 'Creer',
  action: 'Actions',
  search: 'Recherche',
  navigation: 'Navigation',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [productResults, setProductResults] = useState<Action[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setProductResults([]);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Product search debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 3) {
      setProductResults([]);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trending?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results: Action[] = (data.products ?? []).slice(0, 5).map((p: { title: string; price: number; sell_price: number }, i: number) => ({
          id: `product-${i}`,
          label: p.title,
          description: `${p.price.toFixed(2)}€ → ${p.sell_price.toFixed(2)}€`,
          icon: '🛍️',
          section: 'search' as const,
          handler: () => {
            router.push(`/discover?q=${encodeURIComponent(query)}`);
            close();
          },
        }));
        setProductResults(results);
      } catch { setProductResults([]); }
      setSearching(false);
    }, 400);
  }, [query, router, close]);

  const createActions: Action[] = [
    {
      id: 'create-site', label: 'Nouveau site', description: 'Lancer le wizard de creation',
      icon: '✨', section: 'create',
      handler: () => { router.push('/sites/new'); close(); },
    },
    {
      id: 'create-pipeline', label: 'Pipeline A-Z', description: 'Mots-cles → site live',
      icon: '⚡', section: 'create',
      handler: () => { router.push('/agents'); close(); },
    },
  ];

  const quickActions: Action[] = [
    {
      id: 'sync-all', label: 'Sync tous les catalogs', description: 'Lancer un sync CJ sur tous les catalogs',
      icon: '🔄', section: 'action',
      handler: async () => {
        close();
        try {
          const res = await fetch('/api/catalogs');
          const data = await res.json();
          for (const cat of data.catalogs ?? []) {
            fetch(`/api/catalogs/${cat.id}/sync`, { method: 'POST' }).catch(() => {});
          }
        } catch {}
      },
    },
    {
      id: 'health', label: 'Health check', description: 'Verifier les services',
      icon: '💚', section: 'action',
      handler: () => { router.push('/gpu'); close(); },
    },
  ];

  const navActions: Action[] = NAV_ITEMS.map(item => ({
    ...item,
    handler: () => {
      router.push(NAV_PATHS[item.id] ?? '/');
      close();
    },
  }));

  const allActions = [...createActions, ...quickActions, ...productResults, ...navActions];

  const filtered = query.length === 0
    ? allActions
    : allActions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description?.toLowerCase().includes(query.toLowerCase()) ||
        a.section === 'search'
      );

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const runAction = useCallback((action: Action) => {
    action.handler();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      runAction(filtered[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const sections = ['create', 'action', 'search', 'navigation'] as const;
  const grouped = sections
    .map(s => ({ section: s, items: filtered.filter(a => a.section === s) }))
    .filter(g => g.items.length > 0);

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={close}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher, naviguer, creer..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded border bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {grouped.map(g => (
            <div key={g.section}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {SECTION_LABELS[g.section] ?? g.section}
              </p>
              {g.items.map(action => {
                const idx = globalIndex++;
                return (
                  <button
                    key={action.id}
                    onClick={() => runAction(action)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx === selectedIndex
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base">{action.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{action.label}</p>
                      {action.description && (
                        <p className="truncate text-xs text-gray-400">{action.description}</p>
                      )}
                    </div>
                    {idx === selectedIndex && (
                      <kbd className="rounded border bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {searching && (
            <p className="px-3 py-4 text-center text-xs text-gray-400">Recherche produits...</p>
          )}
          {filtered.length === 0 && !searching && (
            <p className="px-3 py-8 text-center text-sm text-gray-400">Aucun resultat pour &quot;{query}&quot;</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2 text-[10px] text-gray-400">
          <div className="flex gap-3">
            <span><kbd className="rounded border bg-white px-1 py-0.5">↑↓</kbd> naviguer</span>
            <span><kbd className="rounded border bg-white px-1 py-0.5">↵</kbd> selectionner</span>
            <span><kbd className="rounded border bg-white px-1 py-0.5">esc</kbd> fermer</span>
          </div>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  );
}
