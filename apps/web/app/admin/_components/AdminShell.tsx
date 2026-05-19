'use client';

import { type ReactNode } from 'react';
import type { HeaderStats } from './getHeaderStats';

type WindowAction = 'close' | 'minimize' | 'maximize';

function callWindowControl(action: WindowAction) {
  const electron = (window as unknown as {
    electron?: { windowControl?: (a: WindowAction) => Promise<void> };
  }).electron;
  void electron?.windowControl?.(action);
}

/**
 * Window controls — Electron-only, drag region.
 * Preserved for apps/desktop (BrowserWindow). On web this bar has
 * no effect (WebkitAppRegion is ignored by Chrome tabs).
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
      style={{
        width: 16, height: 16, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--ct-surface-3)', color: 'var(--ct-text-body)',
        border: 'none', cursor: 'pointer',
        transition: 'background var(--ct-dur-base) var(--ct-ease)',
      }}
    >
      {children}
    </button>
  );
}

function TitleBar() {
  return (
    <div
      style={{
        flexShrink: 0, height: 'var(--ct-titlebar-height)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8,
        userSelect: 'none',
        background: 'var(--ct-surface-2)',
        borderBottom: '1px solid var(--ct-border)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
 * Global KPI strip — 6 live metrics (Stores, Produits, CA 7j,
 * Commandes 30j, Claude runs, Coût Claude) rendered as a compact
 * horizontal bar inside the Cockpit page area.
 *
 * Re-skinned from the former AdminShell SubHeader.
 * Uses --ct-* tokens exclusively, no magic px or colors.
 */
function eur0(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} €`;
}

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ct-text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
        {value}
      </span>
    </div>
  );
}

function HaloWordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none', pointerEvents: 'none' }}>
      <span
        role="img"
        aria-label="HALO"
        style={{
          display: 'inline-block',
          background: 'var(--ct-text-strong)',
          width: 18, height: 20,
          WebkitMaskImage: 'url(/halo-h.svg)',
          maskImage: 'url(/halo-h.svg)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        } as React.CSSProperties}
      />
      <span style={{ color: 'var(--ct-text-primary)', fontSize: 16, fontWeight: 300, letterSpacing: '0.30em', lineHeight: 1, paddingLeft: '0.30em' }}>
        ALO
      </span>
    </div>
  );
}

function KpiStrip({ stats }: { stats: HeaderStats }) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '10px 24px',
        borderBottom: '1px solid var(--ct-border)',
        background: 'var(--ct-surface-1)',
      }}
    >
      {/* Left KPIs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, justifySelf: 'start', minWidth: 0, overflow: 'hidden' }}>
        <KpiChip label="Stores" value={stats.activeStores.toLocaleString('fr-FR')} />
        <KpiChip label="Produits" value={stats.productsTotal.toLocaleString('fr-FR')} />
        <KpiChip label="CA 7j" value={eur0(stats.revenue7dCents)} />
      </div>

      {/* Centered wordmark — grid center column, naturally centered */}
      <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
        <HaloWordmark />
      </div>

      {/* Right KPIs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, justifySelf: 'end', minWidth: 0, overflow: 'hidden' }}>
        <KpiChip label="Commandes 30j" value={stats.orders30d.toLocaleString('fr-FR')} />
        <KpiChip label="Claude runs" value={stats.aiRuns30d.toLocaleString('fr-FR')} />
        <KpiChip label="Coût Claude" value={`${stats.aiCost30dEur.toFixed(2)} €`} />
      </div>
    </div>
  );
}

/**
 * AdminShell — Cockpit-compatible wrapper for all /admin/* pages.
 *
 * MIGRATION NOTES (Cockpit migration, groupA):
 *   - Removed: outer flex-col min-h-screen shell (CockpitShell handles this).
 *   - Removed: FloatingDock footer (nav now in RailLeft + BottomBar).
 *   - Removed: scrollable `<main>` wrapper (`.ct-page-area` scrolls).
 *   - Preserved: Electron TitleBar (WebkitAppRegion drag) for apps/desktop.
 *   - Preserved: 6-KPI strip (was SubHeader, now KpiStrip) — live portfolio metrics.
 *   - Preserved: `getHeaderStats()` data flow in admin/(app)/layout.tsx.
 *   - The children render directly; AdminShell is now a transparent pass-through
 *     that only adds the Electron chrome + KPI bar at the top.
 */
export function AdminShell({ children, stats }: { children: ReactNode; stats: HeaderStats }) {
  return (
    <>
      {/* Electron-only drag titlebar — no-op in browser tabs */}
      <TitleBar />
      {/* Live portfolio KPIs — replaces the old SubHeader */}
      <KpiStrip stats={stats} />
      {/* Page content — rendered directly in .ct-page-area via layout.tsx */}
      {children}
    </>
  );
}
