'use client';

import { useHubMode } from '@hearst/hub-sdk';
import RailLeft from '@/components/cockpit/RailLeft';
import CenterPanel from '@/components/cockpit/CenterPanel';
import RailRight from '@/components/cockpit/RailRight';

interface CockpitShellProps {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Contrat hub-mode Phase A — embarqué dans le hub Hearst (?hub=1 / window.hearstHub)
// Merchant masque son propre chrome (rail gauche, rail droit, ambients) pour ne
// pas doubler le chrome du hub. Standalone (isHub===false) : no-op strict.
//
// Accent produit Merchant : #1FA974
//
// WHY backdrop-filter → none :
// Dans un guest <webview> Electron, Chromium ne peut pas résoudre
// backdrop-filter:blur, -webkit-backdrop-filter, ni mask-image correctement →
// zones noires/vides. On neutralise .ct-rail-left, .ct-rail-right, .ct-bottom-bar
// qui portent ces propriétés.
// ---------------------------------------------------------------------------
function HubModeStyles() {
  const { isHub } = useHubMode();
  if (!isHub) return null;
  return (
    <style>{`
      /* ── Chrome Merchant : rails + ambients masqués ──────────────── */
      .ct-rail-left   { display: none !important; }
      .ct-rail-right  { display: none !important; }
      .ct-ambient-deep { display: none !important; }
      .ct-ambient-glow { display: none !important; }
      .ct-bottom-bar  { display: none !important; }

      /* ── Center panel full-width sans les rails ──────────────────── */
      .ct-center-panel {
        min-width: 0 !important;
        flex: 1 !important;
      }

      /* ── backdrop-filter → none (webview compositing) ────────────── */
      .ct-rail-left,
      .ct-rail-left::before {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--ct-surface-2) !important;
      }
      .ct-rail-right,
      .ct-rail-right::before {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--ct-surface-2) !important;
      }
      .ct-bottom-bar {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
    `}</style>
  );
}

/**
 * CockpitShell — shell bordeaux verre dépoli.
 * Enveloppe TOUTES les routes /admin* (monté dans AppFrame).
 * Structure : .ct-root > ambients + .ct-panels-row > RailLeft | CenterPanel | RailRight
 */
export default function CockpitShell({ children }: CockpitShellProps) {
  return (
    <div className="ct-root">
      <div className="ct-ambient-deep" />
      <div className="ct-ambient-glow" />

      <HubModeStyles />

      <div className="ct-panels-row">
        <RailLeft />
        <CenterPanel>{children}</CenterPanel>
        <RailRight />
      </div>
    </div>
  );
}
