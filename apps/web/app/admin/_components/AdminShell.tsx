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

type WindowAction = 'close' | 'minimize' | 'maximize';

function callWindowControl(action: WindowAction) {
  const electron = (window as unknown as {
    electron?: { windowControl?: (a: WindowAction) => Promise<void> };
  }).electron;
  void electron?.windowControl?.(action);
}

function TitleBar() {
  return (
    <div
      className="shrink-0 h-10 bg-indigo-600 flex items-center px-4 gap-2 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => callWindowControl('close')}
          aria-label="Fermer"
          title="Fermer"
          className="w-3 h-3 rounded-full bg-white hover:bg-white/80 transition-colors"
        />
        <button
          type="button"
          onClick={() => callWindowControl('minimize')}
          aria-label="Réduire"
          title="Réduire"
          className="w-3 h-3 rounded-full bg-white hover:bg-white/80 transition-colors"
        />
        <button
          type="button"
          onClick={() => callWindowControl('maximize')}
          aria-label="Plein écran"
          title="Plein écran"
          className="w-3 h-3 rounded-full bg-white hover:bg-white/80 transition-colors"
        />
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const logout = () => {
    document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col h-screen overflow-hidden">
      <TitleBar />

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="w-full px-5 py-4 flex-1 flex flex-col">{children}</div>
        </div>

        <footer className="shrink-0 bg-indigo-600 px-5 py-3 relative">
          <div className="w-full grid grid-cols-3 items-center">
            <span className="text-xs text-indigo-200">Dropship · Production · Agent IA</span>

            {/* Dock centré dans le footer */}
            <div className="flex justify-center">
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

            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-indigo-200 font-mono">v0.1.0</span>
              <button
                type="button"
                onClick={logout}
                title="Déconnexion"
                aria-label="Déconnexion"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <LogOut size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
