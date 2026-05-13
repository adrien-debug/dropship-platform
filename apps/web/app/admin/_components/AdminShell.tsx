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
  X,
  Minus,
  Maximize2,
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
      className="relative shrink-0 h-10 flex items-center px-4 gap-2 select-none border-b border-indigo-500/40"
      style={{
        background: 'linear-gradient(180deg, #6056f5 0%, #4f46e5 60%, #4338ca 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 0 rgba(0,0,0,0.10)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Window controls */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => callWindowControl('close')}
          aria-label="Fermer"
          title="Fermer"
          className="group w-3.5 h-3.5 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-colors"
        >
          <X size={7} strokeWidth={2.5} className="text-indigo-600" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => callWindowControl('minimize')}
          aria-label="Réduire"
          title="Réduire"
          className="group w-3.5 h-3.5 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-colors"
        >
          <Minus size={7} strokeWidth={2.5} className="text-indigo-600" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => callWindowControl('maximize')}
          aria-label="Plein écran"
          title="Plein écran"
          className="group w-3.5 h-3.5 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-colors"
        >
          <Maximize2 size={7} strokeWidth={2.5} className="text-indigo-600" aria-hidden />
        </button>
      </div>

      {/* Centered logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold tracking-tight text-sm leading-none">
            <span className="text-white/60 font-light">H</span>
            <span className="text-white"> · </span>
            <span className="text-white">Drop</span>
          </span>
        </div>
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

        <footer
          className="shrink-0 px-5 py-3 relative border-t border-indigo-500/40"
          style={{
            background: 'linear-gradient(180deg, #5b52f0 0%, #4338ca 60%, #3730a3 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 -1px 0 rgba(0,0,0,0.12)',
          }}
        >
          <div className="w-full grid grid-cols-3 items-center">
            <span className="text-xs text-indigo-200/80 tracking-wide">Dropship · Agent IA</span>

            {/* Dock centré dans le footer */}
            <div className="flex justify-center">
              <FloatingDock
                items={[
                  { title: 'Dashboard',     href: '/admin',               icon: <LayoutGrid size={17} strokeWidth={1.5} /> },
                  { title: 'Stores',        href: '/admin/stores',        icon: <Layers size={17} strokeWidth={1.5} /> },
                  { title: 'Nouveau store', href: '/admin/stores/new',    icon: <Sparkles size={17} strokeWidth={1.5} /> },
                  { title: 'Commandes',     href: '/admin/orders',        icon: <ShoppingBag size={17} strokeWidth={1.5} /> },
                  { title: 'Marketing',     href: '/admin/observability', icon: <LineChart size={17} strokeWidth={1.5} /> },
                  { title: 'Réglages',      href: '/admin/settings',      icon: <Cog size={17} strokeWidth={1.5} /> },
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
