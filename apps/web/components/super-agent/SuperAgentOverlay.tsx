'use client';

/**
 * SuperAgentOverlay — floating bottom-right chat panel.
 *
 * BEHAVIOR UNCHANGED from the original implementation:
 *   ⌘⇧K / Ctrl⇧K  → toggle open/closed
 *   Escape          → close
 *   Closed state    → circular floating button (fixed bottom-right)
 *   Open state      → floating card, 420 px wide, up to 620 px tall, minimizable
 *
 * Chat state is now owned by useSuperAgentChat (shared hook) so RailRight
 * can also host a SuperAgentPanel without duplicating the SSE/session logic.
 * The two instances share the same localStorage key (super-agent:session-id)
 * and will therefore show the same active session — opening the overlay while
 * the rail is already showing a conversation will resume that same session.
 */

import { useState, useEffect } from 'react';
import { useSuperAgentChat, type SuperAgentMessage, type SessionListItem } from './useSuperAgentChat';

export default function SuperAgentOverlay() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const chat = useSuperAgentChat({ hydrateOnMount: false });

  // ── Keyboard shortcut ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        setMinimized(false);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Hydrate session on first open
  useEffect(() => {
    if (open) {
      chat.tryHydrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Closed state: floating button ──────────────────────────
  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[9998]">
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          title="Super Agent (⌘⇧K)"
          className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-chrome)] text-white ring-1 ring-white/10 transition-transform hover:scale-105 active:scale-95"
          style={{ boxShadow: 'var(--ct-shadow-depth)' }}
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(56,189,248,0.35),transparent_60%)] opacity-60" />
          <svg viewBox="0 0 24 24" fill="none" className="relative h-5 w-5">
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--admin-accent)] ring-2 ring-white" />
        </button>
      </div>
    );
  }

  const headerHeight = 44;

  // ── Open state: floating card ──────────────────────────────
  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] bg-[var(--admin-bg)]"
      style={{ boxShadow: 'var(--ct-shadow-depth)', height: minimized ? headerHeight : 'min(620px, calc(100vh - 3rem))' }}
    >
      {/* Header (chrome bar) */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 bg-[var(--admin-chrome)] px-3 text-white"
        style={{ height: headerHeight }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
            <span className={`absolute inset-0 rounded-full bg-[var(--admin-accent)]/30 ${chat.streaming ? 'animate-ping' : ''}`} />
            <svg viewBox="0 0 24 24" fill="none" className="relative h-3.5 w-3.5">
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 4v1.5M12 18.5V20M4 12h1.5M18.5 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold tracking-tight">Super Agent</span>
            <span className="truncate text-[10px] uppercase tracking-[0.08em] text-white/45">
              {chat.streaming ? 'Réflexion…' : 'Prêt'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={chat.startNewSession}
            disabled={chat.streaming}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            title="Nouvelle session"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={chat.openHistory}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
            title="Historique"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M2 3.5h8M2 6h8M2 8.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <kbd className="mx-1 hidden rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/55 ring-1 ring-white/10 sm:inline-block">
            ⌘⇧K
          </kbd>
          <button
            onClick={() => setMinimized((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
            title={minimized ? 'Agrandir' : 'Réduire'}
          >
            {minimized ? (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path d="M2.5 7.5 6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path d="M2.5 5 6 8.5 9.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => {
              chat.abortRef.current?.abort();
              setOpen(false);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
            title="Fermer"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {!minimized && chat.historyOpen && (
        <HistoryPanel
          chat={chat}
          theme="admin"
        />
      )}

      {!minimized && !chat.historyOpen && (
        <ChatBody chat={chat} theme="admin" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared sub-components used by both overlay and SuperAgentPanel
// ─────────────────────────────────────────────────────────────

type ChatReturn = ReturnType<typeof useSuperAgentChat>;

/** Theme tokens — 'admin' uses --admin-* vars, 'cockpit' uses --ct-* */
export type SuperAgentTheme = 'admin' | 'cockpit';

/**
 * HistoryPanel — session list, shared between overlay and rail.
 * Exported so SuperAgentPanel can compose it.
 */
export function HistoryPanel({
  chat,
  theme,
}: {
  chat: ChatReturn;
  theme: SuperAgentTheme;
}) {
  const ck = theme === 'cockpit';

  if (!ck) {
    // Original admin rendering (Tailwind classes, --admin-* vars)
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--admin-bg-subtle)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
            Sessions récentes
          </span>
          <button
            onClick={() => chat.openHistory()}
            className="text-[11px] text-[var(--admin-text-muted)] underline-offset-2 hover:text-[var(--admin-text)] hover:underline"
          >
            Fermer
          </button>
        </div>
        {chat.historyLoading ? (
          <div className="py-8 text-center text-[11.5px] text-[var(--admin-text-muted)]">Chargement…</div>
        ) : chat.historyItems.length === 0 ? (
          <div className="py-8 text-center text-[11.5px] text-[var(--admin-text-muted)]">
            Aucune session enregistrée.
          </div>
        ) : (
          <div className="space-y-1.5">
            {chat.historyItems.map((s) => (
              <SessionRow key={s.id} s={s} chat={chat} theme="admin" />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Cockpit rail rendering (--ct-* tokens via inline styles)
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--ct-surface-0)', padding: '12px' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ct-text-muted)' }}>
          Sessions récentes
        </span>
        <button
          onClick={() => chat.openHistory()}
          style={{ fontSize: 11, color: 'var(--ct-text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Fermer
        </button>
      </div>
      {chat.historyLoading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 11.5, color: 'var(--ct-text-muted)' }}>Chargement…</div>
      ) : chat.historyItems.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 11.5, color: 'var(--ct-text-muted)' }}>Aucune session enregistrée.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chat.historyItems.map((s) => (
            <SessionRow key={s.id} s={s} chat={chat} theme="cockpit" />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  s,
  chat,
  theme,
}: {
  s: SessionListItem;
  chat: ChatReturn;
  theme: SuperAgentTheme;
}) {
  const active = s.id === chat.sessionId;
  if (theme === 'admin') {
    return (
      <div
        className={`group flex items-start gap-2 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] bg-white px-2.5 py-2 transition hover:border-[var(--admin-accent)] ${
          active ? 'ring-1 ring-[var(--admin-accent)]' : ''
        }`}
      >
        <button onClick={() => chat.resumeSession(s.id)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-[var(--admin-text)]">
              {s.title || s.preview?.slice(0, 60) || 'Sans titre'}
            </span>
            {s.store_name && (
              <span className="shrink-0 rounded-full bg-[var(--admin-accent-soft)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-[var(--admin-accent)]">
                {s.store_name.slice(0, 18)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[var(--admin-text-muted)]">
            <span>{new Date(s.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span>·</span>
            <span>{s.message_count} msg</span>
          </div>
        </button>
        <button
          onClick={() => chat.deleteSession(s.id)}
          title="Supprimer"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--admin-text-faint)] opacity-0 transition hover:bg-[var(--admin-danger-soft)] hover:text-[var(--admin-danger)] group-hover:opacity-100"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  // Cockpit theme
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      borderRadius: 8,
      border: active ? '1px solid var(--ct-accent)' : '1px solid var(--ct-border)',
      background: 'var(--ct-surface-1)',
      padding: '8px 10px',
      outline: active ? '1px solid var(--ct-accent)' : 'none',
    }}>
      <button
        onClick={() => chat.resumeSession(s.id)}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.title || s.preview?.slice(0, 60) || 'Sans titre'}
          </span>
          {s.store_name && (
            <span style={{ flexShrink: 0, borderRadius: 9999, background: 'var(--ct-accent-soft)', padding: '2px 6px', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ct-accent)' }}>
              {s.store_name.slice(0, 18)}
            </span>
          )}
        </div>
        <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--ct-text-muted)', display: 'flex', gap: 6 }}>
          <span>{new Date(s.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span>·</span>
          <span>{s.message_count} msg</span>
        </div>
      </button>
      <button
        onClick={() => chat.deleteSession(s.id)}
        title="Supprimer"
        style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ct-text-faint)' }}
      >
        <svg viewBox="0 0 12 12" style={{ width: 12, height: 12 }} fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * ChatBody — messages list + input textarea.
 * Shared between overlay and SuperAgentPanel.
 */
export function ChatBody({
  chat,
  theme,
}: {
  chat: ChatReturn;
  theme: SuperAgentTheme;
}) {
  const ck = theme === 'cockpit';

  if (!ck) {
    // Original admin rendering (Tailwind + --admin-* vars)
    return (
      <>
        <div
          ref={chat.scrollRef}
          className="flex-1 min-h-0 overflow-y-auto bg-[var(--admin-bg-subtle)] px-3 py-3"
        >
          {chat.hydrating ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-[var(--admin-text-muted)]">Restauration de la session…</p>
            </div>
          ) : chat.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] ring-1 ring-[var(--admin-accent)]/15">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-[var(--admin-accent)]">
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[var(--admin-text)]">Super Agent</p>
              <p className="mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-[var(--admin-text-muted)]">
                Je peux coder, modifier la base, générer des assets et déployer. Dis-moi quoi faire.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {chat.messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} theme="admin" onConfirm={() => chat.handleConfirm(msg)} />
              ))}
              {chat.streaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-[var(--admin-radius-lg)] bg-white px-3 py-2 ring-1 ring-[var(--admin-border)]">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-bg)] p-2.5">
          <div className="flex items-end gap-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2.5 py-1.5 transition focus-within:border-[var(--admin-accent)] focus-within:ring-2 focus-within:ring-[var(--admin-accent-ring)]">
            <textarea
              value={chat.input}
              onChange={(e) => chat.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  chat.sendMessage(chat.input);
                }
              }}
              placeholder="Dis-moi quoi faire…"
              disabled={chat.streaming}
              rows={1}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[var(--admin-text)] placeholder:text-[var(--admin-text-faint)] focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => chat.sendMessage(chat.input)}
              disabled={chat.streaming || !chat.input.trim()}
              title="Envoyer (Entrée)"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)] bg-[var(--admin-chrome)] text-white transition hover:bg-[var(--admin-chrome-soft)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </>
    );
  }

  // Cockpit rail rendering (--ct-* tokens, inline styles)
  return (
    <>
      <style>{`
        @keyframes ct-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <div
        ref={chat.scrollRef}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--ct-surface-0)', padding: '12px', display: 'flex', flexDirection: 'column' }}
      >
        {chat.hydrating ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 150, 300].map((d) => (
                <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ct-text-muted)', animation: 'ct-pulse 1.5s ease-in-out infinite', animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ct-text-muted)' }}>Restauration de la session…</p>
          </div>
        ) : chat.messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ marginBottom: 12, width: 44, height: 44, borderRadius: '50%', background: 'var(--ct-accent-soft)', border: '1px solid rgba(225,29,72,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20, color: 'var(--ct-accent)' }}>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ct-text-primary)' }}>Super Agent</p>
            <p style={{ marginTop: 4, maxWidth: 260, fontSize: 11.5, lineHeight: '1.6', color: 'var(--ct-text-muted)' }}>
              Je peux coder, modifier la base, générer des assets et déployer. Dis-moi quoi faire.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chat.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} theme="cockpit" onConfirm={() => chat.handleConfirm(msg)} />
            ))}
            {chat.streaming && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, background: 'var(--ct-surface-1)', padding: '8px 12px', border: '1px solid var(--ct-border)' }}>
                  {[0, 150, 300].map((d) => (
                    <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ct-text-muted)', animation: 'ct-pulse 1.5s ease-in-out infinite', animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', padding: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, borderRadius: 10, border: '1px solid var(--ct-border)', background: 'var(--ct-surface-0)', padding: '6px 10px' }}>
          <textarea
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chat.sendMessage(chat.input);
              }
            }}
            placeholder="Dis-moi quoi faire…"
            disabled={chat.streaming}
            rows={1}
            style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, lineHeight: '1.5', color: 'var(--ct-text-primary)', maxHeight: 128, minHeight: 24, fontFamily: 'inherit', opacity: chat.streaming ? 0.5 : 1 }}
          />
          <button
            onClick={() => chat.sendMessage(chat.input)}
            disabled={chat.streaming || !chat.input.trim()}
            title="Envoyer (Entrée)"
            style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'var(--ct-accent)', color: 'var(--ct-text-strong)', border: 'none', cursor: chat.streaming || !chat.input.trim() ? 'not-allowed' : 'pointer', opacity: chat.streaming || !chat.input.trim() ? 0.3 : 1, transition: `opacity var(--ct-dur-base) var(--ct-ease)` }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * MessageBubble — renders a single message in either theme.
 * Exported for potential use in other panels.
 */
export function MessageBubble({
  msg,
  onConfirm,
  theme = 'admin',
}: {
  msg: SuperAgentMessage;
  onConfirm: () => void;
  theme?: SuperAgentTheme;
}) {
  const ck = theme === 'cockpit';

  if (msg.role === 'user') {
    if (ck) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: '85%', borderRadius: '12px 12px 4px 12px', background: 'var(--ct-accent)', padding: '8px 12px', fontSize: 12.5, lineHeight: '1.6', color: 'var(--ct-text-strong)' }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--admin-radius-lg)] rounded-br-sm bg-[var(--admin-chrome)] px-3 py-2 text-[12.5px] leading-relaxed text-white">
          <div className="whitespace-pre-wrap">{msg.text}</div>
        </div>
      </div>
    );
  }

  if (msg.role === 'system') {
    if (ck) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ maxWidth: '90%', borderRadius: 10, border: '1px solid var(--ct-warning-border)', background: 'var(--ct-warning-soft)', padding: '8px 12px', fontSize: 12, lineHeight: '1.6', color: 'var(--ct-text-body)' }}>
            {msg.text && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
            {msg.confirmRequired && (
              <button
                onClick={onConfirm}
                style={{ marginTop: 8, borderRadius: 6, background: 'var(--ct-warning)', padding: '3px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ct-bg-deep)', border: 'none', cursor: 'pointer' }}
              >
                {msg.confirmTool ? `Confirmer ${msg.confirmTool}` : "Confirmer l'action"}
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-[var(--admin-radius-lg)] border border-[var(--admin-warning)]/25 bg-[var(--admin-warning-soft)] px-3 py-2 text-[12px] leading-relaxed text-[#92400e]">
          {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
          {msg.confirmRequired && (
            <button
              onClick={onConfirm}
              className="mt-2 rounded-[var(--admin-radius-sm)] bg-[var(--admin-warning)] px-2.5 py-1 text-[11px] font-medium text-white transition hover:opacity-90"
            >
              {msg.confirmTool ? `Confirmer ${msg.confirmTool}` : "Confirmer l'action"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'tool') {
    const out = msg.toolOutput ? JSON.stringify(msg.toolOutput, null, 2) : null;
    const inp = msg.toolInput ? JSON.stringify(msg.toolInput, null, 2) : null;
    if (ck) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ width: '100%', maxWidth: '92%', overflow: 'hidden', borderRadius: 8, border: msg.isError ? '1px solid rgba(225,29,72,0.3)' : '1px solid var(--ct-border)', background: msg.isError ? 'rgba(225,29,72,0.08)' : 'var(--ct-surface-1)', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--ct-border-soft)', padding: '6px 10px' }}>
              <svg viewBox="0 0 12 12" style={{ width: 12, height: 12, color: 'var(--ct-text-muted)', flexShrink: 0 }} fill="none">
                <path d="M9.5 2.5 8 4l2 2 1.5-1.5-2-2ZM7 5 3 9v2h2l4-4-2-2Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 600, color: 'var(--ct-text-muted)' }}>
                {msg.toolName ?? 'tool'}
              </span>
              {msg.isError && (
                <span style={{ marginLeft: 'auto', borderRadius: 4, background: 'rgba(225,29,72,0.15)', padding: '2px 6px', fontWeight: 600, color: 'var(--ct-accent-strong)', fontSize: 10 }}>
                  error
                </span>
              )}
            </div>
            {(inp || out) && (
              <pre style={{ maxHeight: 120, overflow: 'auto', background: 'var(--ct-surface-0)', padding: '6px 10px', fontFamily: 'monospace', fontSize: 10.5, lineHeight: '1.4', color: 'var(--ct-text-body)', margin: 0 }}>
                {out ?? inp}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-start">
        <div
          className={`w-full max-w-[92%] overflow-hidden rounded-[var(--admin-radius-md)] border text-[11px] ${
            msg.isError
              ? 'border-[var(--admin-danger)]/25 bg-[var(--admin-danger-soft)]'
              : 'border-[var(--admin-border)] bg-white'
          }`}
        >
          <div className="flex items-center gap-1.5 border-b border-[var(--admin-border-soft)] px-2.5 py-1.5">
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--admin-text-muted)]" fill="none">
              <path d="M9.5 2.5 8 4l2 2 1.5-1.5-2-2ZM7 5 3 9v2h2l4-4-2-2Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[10.5px] font-semibold text-[var(--admin-text-secondary)]">
              {msg.toolName ?? 'tool'}
            </span>
            {msg.isError && (
              <span className="ml-auto rounded-[var(--admin-radius-sm)] bg-[var(--admin-danger)]/10 px-1.5 py-0.5 font-medium text-[var(--admin-danger)]">
                error
              </span>
            )}
          </div>
          {(inp || out) && (
            <pre className="max-h-40 overflow-auto bg-[var(--admin-bg-subtle)] px-2.5 py-1.5 font-mono text-[10.5px] leading-snug text-[var(--admin-text-secondary)]">
              {out ?? inp}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // assistant
  if (ck) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{ maxWidth: '90%', borderRadius: '4px 12px 12px 12px', border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', padding: '8px 12px', fontSize: 12.5, lineHeight: '1.6', color: 'var(--ct-text-primary)' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-[var(--admin-radius-lg)] rounded-bl-sm border border-[var(--admin-border)] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[var(--admin-text)]">
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
    </div>
  );
}
