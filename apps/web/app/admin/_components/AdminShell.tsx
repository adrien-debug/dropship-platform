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

/**
 * macOS-style traffic light controls: close (red) / minimize (yellow) /
 * maximize (green). The colored dots are intentionally subtle — they only
 * surface a centered glyph on hover, like a real macOS title bar.
 */
function TrafficLight({
  color,
  hoverColor,
  glyphColor,
  onClick,
  label,
  children,
}: {
  color: string;
  hoverColor: string;
  glyphColor: string;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group relative w-3 h-3 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-admin-chrome"
      style={{ background: color }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverColor)}
      onMouseLeave={(e) => (e.currentTarget.style.background = color)}
    >
      <span
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: glyphColor }}
        aria-hidden
      >
        {children}
      </span>
    </button>
  );
}

function TitleBar() {
  return (
    <div
      className="relative shrink-0 h-9 flex items-center px-3.5 gap-2 select-none bg-admin-chrome"
      style={{
        boxShadow: 'var(--admin-shadow-chrome)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* macOS traffic lights */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <TrafficLight
          color="#ff5f57"
          hoverColor="#ff5f57"
          glyphColor="#4d0000"
          onClick={() => callWindowControl('close')}
          label="Fermer"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1.5 1.5l3 3M4.5 1.5l-3 3" />
          </svg>
        </TrafficLight>
        <TrafficLight
          color="#febc2e"
          hoverColor="#febc2e"
          glyphColor="#7a4d00"
          onClick={() => callWindowControl('minimize')}
          label="Réduire"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1 3h4" />
          </svg>
        </TrafficLight>
        <TrafficLight
          color="#28c840"
          hoverColor="#28c840"
          glyphColor="#003d00"
          onClick={() => callWindowControl('maximize')}
          label="Plein écran"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M2 1h3v3M4 5H1V2" />
          </svg>
        </TrafficLight>
      </div>

      {/* Centered wordmark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[12px] font-medium tracking-[0.04em] text-white/85 leading-none">
          H · Drop
        </span>
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
    <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-admin-bg">
      <TitleBar />

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="w-full px-6 py-5 flex-1 flex flex-col">{children}</div>
        </div>

        <footer
          className="shrink-0 px-5 py-2.5 relative bg-admin-chrome"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 -1px 0 rgba(0,0,0,0.40)',
          }}
        >
          <div className="w-full grid grid-cols-3 items-center">
            <span className="text-[11px] text-white/55 tracking-[0.06em]">
              Dropship · Agent IA
            </span>

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
              <span className="text-[11px] text-white/40 font-mono tabular-nums">v0.1.0</span>
              <button
                type="button"
                onClick={logout}
                title="Déconnexion"
                aria-label="Déconnexion"
                className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus-visible:ring-offset-admin-chrome"
              >
                <LogOut size={13} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
