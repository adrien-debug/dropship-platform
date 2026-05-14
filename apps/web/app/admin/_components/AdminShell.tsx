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
import type { HeaderStats } from './getHeaderStats';

type WindowAction = 'close' | 'minimize' | 'maximize';

function callWindowControl(action: WindowAction) {
  const electron = (window as unknown as {
    electron?: { windowControl?: (a: WindowAction) => Promise<void> };
  }).electron;
  void electron?.windowControl?.(action);
}

/**
 * Window controls: black pill buttons with white glyphs always visible.
 * No macOS color coding — we want a uniform chrome that matches the
 * black titlebar + footer rather than borrowing macOS's traffic lights.
 */
function WindowButton({
  onClick,
  label,
  children,
}: {
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
      className="w-4 h-4 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.14] text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-admin-chrome"
    >
      {children}
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
      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <WindowButton onClick={() => callWindowControl('close')} label="Fermer">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M2 2l4 4M6 2l-4 4" />
          </svg>
        </WindowButton>
        <WindowButton onClick={() => callWindowControl('minimize')} label="Réduire">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M1.5 4h5" />
          </svg>
        </WindowButton>
        <WindowButton onClick={() => callWindowControl('maximize')} label="Plein écran">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 5v1.5h1.5M6 3V1.5H4.5" />
          </svg>
        </WindowButton>
      </div>
    </div>
  );
}

/**
 * Sub-header below the titlebar — pure brand bar. 3 KPIs left, ALHALO
 * wordmark centered (the H is the dotted SVG mark), 3 KPIs right.
 * Always black, always present, matches the footer's visual weight so
 * the chrome reads as balanced top vs bottom.
 */
function eur0(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} €`;
}

function KpiBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-[10px] tracking-[0.16em] uppercase text-white/45 font-medium">
        {label}
      </span>
      <span className="text-[13px] font-semibold text-white/90 tabular-nums mt-0.5">
        {value}
      </span>
    </div>
  );
}

function HaloWordmark() {
  // H = dotted SVG used as a CSS mask so we can paint it pure white
  // regardless of the source SVG fill. ALO = text in a thin geometric
  // sans set with wide tracking to match the dotted H's spacing.
  return (
    <div className="flex items-center select-none pointer-events-none">
      <span
        role="img"
        aria-label="HALO"
        className="inline-block bg-white"
        style={{
          width: '20px',
          height: '22px',
          WebkitMaskImage: 'url(/halo-h.svg)',
          maskImage: 'url(/halo-h.svg)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      <span className="text-white text-[18px] font-light tracking-[0.32em] leading-none pl-[0.34em]">
        ALO
      </span>
    </div>
  );
}

function SubHeader({ stats }: { stats: HeaderStats }) {
  return (
    <div
      className="shrink-0 h-14 bg-admin-chrome border-b border-white/[0.05] flex items-center px-6"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
    >
      {/* Left KPIs */}
      <div className="flex items-center gap-7 flex-1">
        <KpiBlock label="Stores" value={stats.activeStores.toLocaleString('fr-FR')} />
        <KpiBlock label="Produits" value={stats.productsTotal.toLocaleString('fr-FR')} />
        <KpiBlock label="CA 7j" value={eur0(stats.revenue7dCents)} />
      </div>

      {/* Centered HALO wordmark */}
      <div className="flex items-center justify-center shrink-0 px-8">
        <HaloWordmark />
      </div>

      {/* Right KPIs */}
      <div className="flex items-center gap-7 flex-1 justify-end">
        <KpiBlock label="Commandes 30j" value={stats.orders30d.toLocaleString('fr-FR')} />
        <KpiBlock label="Claude runs" value={stats.aiRuns30d.toLocaleString('fr-FR')} />
        <KpiBlock label="Coût Claude" value={`${stats.aiCost30dEur.toFixed(2)} €`} />
      </div>
    </div>
  );
}

export function AdminShell({ children, stats }: { children: ReactNode; stats: HeaderStats }) {
  const logout = () => {
    document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-admin-bg">
      <TitleBar />
      <SubHeader stats={stats} />

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="w-full px-6 py-5 flex-1 flex flex-col">{children}</div>
        </div>

        <footer
          className="shrink-0 px-5 py-2 relative bg-admin-chrome"
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
                  { title: 'Dashboard',     href: '/admin',               icon: <LayoutGrid size={18} strokeWidth={1.75} /> },
                  { title: 'Stores',        href: '/admin/stores',        icon: <Layers size={18} strokeWidth={1.75} /> },
                  { title: 'Nouveau store', href: '/admin/stores/new',    icon: <Sparkles size={18} strokeWidth={1.75} /> },
                  { title: 'Commandes',     href: '/admin/orders',        icon: <ShoppingBag size={18} strokeWidth={1.75} /> },
                  { title: 'Marketing',     href: '/admin/observability', icon: <LineChart size={18} strokeWidth={1.75} /> },
                  { title: 'Réglages',      href: '/admin/settings',      icon: <Cog size={18} strokeWidth={1.75} /> },
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
