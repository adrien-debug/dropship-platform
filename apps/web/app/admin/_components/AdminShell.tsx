'use client';

import { type ReactNode } from 'react';
import {
  LayoutGrid,
  Layers,
  Sparkles,
  ShoppingBag,
  LineChart,
  Cog,
  LogOut,
} from 'lucide-react';
import { FloatingDock } from '@/components/ui/floating-dock';

export function AdminShell({ children }: { children: ReactNode }) {
  const logout = () => {
    document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col h-screen overflow-hidden">
      {/* Title bar indigo — sert de zone draggable derrière les traffic lights */}
      <div
        className="shrink-0 h-10 bg-indigo-600"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-5 sm:px-7 py-5 xl:py-7 pb-28">{children}</div>
        </div>

        {/* Floating dock — pastilles blanches, icônes indigo */}
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <FloatingDock
              items={[
                { title: 'Dashboard',     href: '/admin',               icon: <LayoutGrid className="h-full w-full" strokeWidth={1.75} /> },
                { title: 'Stores',        href: '/admin/stores',        icon: <Layers className="h-full w-full" strokeWidth={1.75} /> },
                { title: 'Nouveau store', href: '/admin/stores/new',    icon: <Sparkles className="h-full w-full" strokeWidth={1.75} /> },
                { title: 'Commandes',     href: '/admin/orders',        icon: <ShoppingBag className="h-full w-full" strokeWidth={1.75} /> },
                { title: 'Observabilité', href: '/admin/observability', icon: <LineChart className="h-full w-full" strokeWidth={1.75} /> },
                { title: 'Réglages',      href: '/admin/settings',      icon: <Cog className="h-full w-full" strokeWidth={1.75} /> },
              ]}
            />
          </div>
        </div>

        {/* Logout flottant en bas à droite */}
        <button
          type="button"
          onClick={logout}
          title="Déconnexion"
          aria-label="Déconnexion"
          className="absolute bottom-16 right-6 z-30 w-10 h-10 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 flex items-center justify-center shadow-sm transition-colors"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden />
        </button>

        <footer className="shrink-0 bg-indigo-600 px-5 sm:px-7 py-3">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-xs text-indigo-200">
            <span>Dropship · Production · Agent IA</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
