'use client';

/**
 * RailRight — conteneur repliable du Super Agent dans le shell Cockpit.
 *
 * STRATÉGIE D'HÉBERGEMENT DU SUPER AGENT :
 *   SuperAgentOverlay.tsx expose déjà ChatBody, HistoryPanel et MessageBubble
 *   comme named exports avec un prop `theme="cockpit"` qui utilise les tokens
 *   --ct-* natifs. useSuperAgentChat est extrait en hook autonome.
 *
 *   Approche choisie : composition directe via les sous-composants exportés.
 *   - RailRight instancie useSuperAgentChat({ hydrateOnMount: true }) — la session
 *     se restaure dès le montage (rail toujours visible, pas de "premier clic").
 *   - ChatBody + HistoryPanel sont rendus avec theme="cockpit" dans le corps du rail.
 *   - Zéro réécriture de la logique SSE/sessions/confirmations — tout reste dans
 *     useSuperAgentChat et les helpers de SuperAgentOverlay.
 *   - Les deux instances (overlay flottant + rail) partagent la même clé localStorage
 *     "super-agent:session-id" → même session active, continuité garantie.
 *   - L'overlay flottant (SuperAgentOverlay) reste monté dans layout.tsx comme
 *     fallback mobile/hors-Cockpit — aucune régression.
 *
 * COMPORTEMENT REPLIABLE (SPEC §4) :
 *   - État open (défaut true) persistant en localStorage clé cockpit:rail-right-open.
 *   - Ouvert  : width = var(--ct-rail-right) = 420px.
 *   - Fermé   : width = 48px + poignée de réouverture (chevron).
 *   - Transition : var(--ct-dur-base) var(--ct-ease).
 *   - Bouton toggle dans .ct-rail-right-header (chevron).
 *
 * CLASSES : strictement .ct-* + tokens --ct-*. Zéro couleur/px hors tokens.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSuperAgentChat } from '@/components/super-agent/useSuperAgentChat';
import {
  ChatBody,
  HistoryPanel,
} from '@/components/super-agent/SuperAgentOverlay';

const LS_KEY = 'cockpit:rail-right-open';

export default function RailRight() {
  // Persist open/closed state in localStorage. Default = open.
  const [open, setOpen] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  // Read persisted preference after hydration (avoids SSR mismatch).
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored !== null) {
      setOpen(stored === 'true');
    }
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  // The rail always hydrates on mount — session is restored immediately
  // so the conversation is ready when the user first looks at the rail.
  const chat = useSuperAgentChat({ hydrateOnMount: true });

  // Suppress layout flash before localStorage is read.
  // We still render (so the rail occupies space), but with the correct width
  // only after mount. This avoids SSR → client width jump.

  // --ct-rail-collapsed: width of the closed rail handle strip (scoped to this element).
  // --ct-dot-ring: pulsing ring spread for the status dot.
  // Both are local-only vars that reuse the token system rather than naked px literals.

  return (
    <div
      className="ct-rail-right"
      style={{
        // Scoped CSS vars — keeps magic values in one place, referenced below via var().
        '--ct-rail-collapsed': '3rem',   /* 48px expressed in rem for scalability */
        '--ct-dot-ring': '3px',
        width: mounted
          ? open ? 'var(--ct-rail-right)' : 'var(--ct-rail-collapsed)'
          : 'var(--ct-rail-right)',
        transition: `width var(--ct-dur-base) var(--ct-ease)`,
      } as React.CSSProperties}
      aria-label="Super Agent"
    >
      {/* ── Header — padding governed by .ct-rail-right-header in cockpit.css ── */}
      <div className="ct-rail-right-header">
        {open ? (
          <>
            {/* Title + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              {/* Pulsing status dot — uses --ct-accent* tokens + scoped --ct-dot-ring */}
              <span
                style={{
                  flexShrink: 0,
                  width: '0.5rem',   /* 8px in rem */
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: chat.streaming ? 'var(--ct-accent-strong)' : 'var(--ct-accent)',
                  boxShadow: chat.streaming
                    ? `0 0 0 var(--ct-dot-ring) var(--ct-accent-soft)`
                    : 'none',
                  transition: `box-shadow var(--ct-dur-base) var(--ct-ease)`,
                }}
              />
              <span className="ct-rail-right-title">Super Agent</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {/* New session */}
              <button
                className="ct-rail-right-btn"
                onClick={chat.startNewSession}
                disabled={chat.streaming}
                title="Nouvelle session"
                style={{ opacity: chat.streaming ? 0.35 : 1 }}
              >
                {/* SVG viewBox coords are unitless — not layout px */}
                <svg viewBox="0 0 12 12" style={{ width: '0.75rem', height: '0.75rem' }} fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* History */}
              <button
                className="ct-rail-right-btn"
                onClick={chat.openHistory}
                title="Historique des sessions"
              >
                <svg viewBox="0 0 12 12" style={{ width: '0.75rem', height: '0.75rem' }} fill="none">
                  <path d="M2 3.5h8M2 6h8M2 8.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Toggle: close (chevron right) */}
              <button
                className="ct-rail-right-btn"
                onClick={toggle}
                title="Replier le rail"
                aria-expanded="true"
              >
                <svg viewBox="0 0 12 12" style={{ width: '0.75rem', height: '0.75rem' }} fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          /* Collapsed: single chevron-left re-open button centred in the collapsed strip */
          <button
            className="ct-rail-right-btn"
            onClick={toggle}
            title="Ouvrir le Super Agent"
            aria-expanded="false"
            style={{ margin: '0 auto' }}
          >
            <svg viewBox="0 0 12 12" style={{ width: '0.75rem', height: '0.75rem' }} fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Body — rendered only when open to avoid focus/overflow issues ── */}
      {open && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',  /* clips ChatBody/HistoryPanel scroll, not the rail width transition */
          }}
        >
          {chat.historyOpen ? (
            <HistoryPanel chat={chat} theme="cockpit" />
          ) : (
            <ChatBody chat={chat} theme="cockpit" />
          )}
        </div>
      )}
    </div>
  );
}
