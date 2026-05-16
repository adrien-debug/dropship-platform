'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SuperAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  isError?: boolean;
  confirmRequired?: boolean;
  /** Backend-emitted key the UI must echo back to clear the gate. */
  confirmKey?: string;
  /** Tool that triggered the confirm, shown on the button label. */
  confirmTool?: string;
}

interface SessionListItem {
  id: string;
  store_id: string | null;
  store_name: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
  preview_role: 'user' | 'assistant' | 'tool' | null;
}

const SESSION_STORAGE_KEY = 'super-agent:session-id';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

/** Map a stored DB message into the in-panel shape. */
function dbMessageToUI(row: {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
}): SuperAgentMessage {
  if (row.role === 'tool') {
    return {
      id: row.id,
      role: 'tool',
      toolName: row.tool_name ?? 'tool',
      toolInput: row.tool_input,
      toolOutput: row.tool_output,
      // Treat output rows containing an `error` key as errors so the bubble
      // gets the red border on reload, matching the live stream behavior.
      isError: !!(row.tool_output && typeof row.tool_output === 'object' && 'error' in (row.tool_output as Record<string, unknown>)),
    };
  }
  return { id: row.id, role: row.role, text: row.content };
}

/**
 * Safely parse a single SSE event payload. The super-agent stream is
 * piped from the model and the occasional truncated chunk would otherwise
 * crash the whole reader loop. In dev we surface the offender to console
 * so we don't lose the signal that the server is misbehaving.
 */
function safeParseSseEvent(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[super-agent] SSE parse error', err, raw.slice(0, 200));
    }
    return null;
  }
}

export default function SuperAgentOverlay() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<SessionListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // On first open, try to resume the last session id from localStorage. If
  // the GET 404s (session was deleted server-side), clear the stale id so the
  // next message starts fresh instead of failing silently.
  const hydrateFromSession = useCallback(async (id: string) => {
    setHydrating(true);
    try {
      const res = await fetch(`/api/agent/super/sessions/${id}`);
      if (res.status === 404) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionId(null);
        setMessages([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        messages: Array<{
          id: string;
          role: 'user' | 'assistant' | 'tool';
          content: string;
          tool_name: string | null;
          tool_input: unknown;
          tool_output: unknown;
        }>;
      };
      setMessages(data.messages.map(dbMessageToUI));
    } catch (err) {
      console.warn('[super-agent] hydrate session failed', err);
    } finally {
      setHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (sessionId) return;
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      setSessionId(stored);
      hydrateFromSession(stored);
    }
  }, [open, sessionId, hydrateFromSession]);

  const startNewSession = useCallback(() => {
    abortRef.current?.abort();
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setMessages([]);
    setPendingConfirmations({});
    setInput('');
    setStreaming(false);
    setHistoryOpen(false);
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryOpen((v) => !v);
    if (historyOpen) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/agent/super/sessions?limit=30');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessions: SessionListItem[] };
      setHistoryItems(data.sessions);
    } catch (err) {
      console.warn('[super-agent] history load failed', err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyOpen]);

  const resumeSession = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setHistoryOpen(false);
      setPendingConfirmations({});
      localStorage.setItem(SESSION_STORAGE_KEY, id);
      setSessionId(id);
      setMessages([]);
      setStreaming(false);
      await hydrateFromSession(id);
    },
    [hydrateFromSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/agent/super/sessions/${id}`, { method: 'DELETE' });
      } catch {
        /* ignore — refresh below will show the actual state */
      }
      setHistoryItems((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) startNewSession();
    },
    [sessionId, startNewSession],
  );

  const sendMessage = useCallback(
    async (text: string, confirmations?: Record<string, boolean>) => {
      if (!text.trim()) return;

      setMessages((prev) => [...prev, { id: generateId(), role: 'user', text: text.trim() }]);
      setInput('');
      setStreaming(true);

      const assistantId = generateId();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/agent/super', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            page: window.location.pathname,
            sessionId: sessionId ?? undefined,
            confirmations: confirmations ?? pendingConfirmations,
          }),
          signal: abortRef.current.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            const parsed = safeParseSseEvent(json);
            if (!parsed) continue;
            const event = parsed as {
              type: string;
              text?: string;
              name?: string;
              input?: unknown;
              output?: unknown;
              is_error?: boolean;
              tool?: string;
              reason?: string;
              message?: string;
              confirmKey?: string;
              sessionId?: string;
            };

            if (event.type === 'session' && event.sessionId) {
              setSessionId(event.sessionId);
              try { localStorage.setItem(SESSION_STORAGE_KEY, event.sessionId); } catch { /* ignore */ }
            }

            if (event.type === 'thinking' && event.text) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.id === assistantId) {
                  return [...prev.slice(0, -1), { ...last, text: (last.text ?? '') + event.text! }];
                }
                return prev;
              });
            }

            if (event.type === 'tool_call') {
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  role: 'tool',
                  toolName: event.name,
                  toolInput: event.input,
                },
              ]);
            }

            if (event.type === 'tool_result') {
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  role: 'tool',
                  toolName: event.name,
                  toolOutput: event.output,
                  isError: event.is_error,
                },
              ]);
            }

            if (event.type === 'confirm_required') {
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  role: 'system',
                  text: `Confirmation requise : ${event.reason}`,
                  confirmRequired: true,
                  confirmKey: event.confirmKey,
                  confirmTool: event.tool,
                },
              ]);
            }

            if (event.type === 'error') {
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'system', text: `Erreur : ${event.message}` },
              ]);
            }

            if (event.type === 'done') {
              setStreaming(false);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'system', text: `Erreur réseau : ${err.message}` },
          ]);
        }
        setStreaming(false);
      }
    },
    [pendingConfirmations, sessionId],
  );

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[9998]">
        <button
          onClick={() => setOpen(true)}
          title="Super Agent (⌘⇧K)"
          className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-chrome)] text-white shadow-[0_10px_30px_-8px_rgba(10,10,10,0.45)] ring-1 ring-white/10 transition-transform hover:scale-105 active:scale-95"
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

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] bg-[var(--admin-bg)] shadow-[0_24px_60px_-20px_rgba(10,10,10,0.35),0_8px_20px_-8px_rgba(10,10,10,0.15)]"
      style={{ height: minimized ? headerHeight : 'min(620px, calc(100vh - 3rem))' }}
    >
      {/* Header (chrome bar) */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 bg-[var(--admin-chrome)] px-3 text-white"
        style={{ height: headerHeight }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
            <span className={`absolute inset-0 rounded-full bg-[var(--admin-accent)]/30 ${streaming ? 'animate-ping' : ''}`} />
            <svg viewBox="0 0 24 24" fill="none" className="relative h-3.5 w-3.5">
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 4v1.5M12 18.5V20M4 12h1.5M18.5 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold tracking-tight">Super Agent</span>
            <span className="truncate text-[10px] uppercase tracking-[0.08em] text-white/45">
              {streaming ? 'Réflexion…' : 'Prêt'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={startNewSession}
            disabled={streaming}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            title="Nouvelle session"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={openHistory}
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
              abortRef.current?.abort();
              setStreaming(false);
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

      {!minimized && historyOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--admin-bg-subtle)] px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
              Sessions récentes
            </span>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-[11px] text-[var(--admin-text-muted)] underline-offset-2 hover:text-[var(--admin-text)] hover:underline"
            >
              Fermer
            </button>
          </div>
          {historyLoading ? (
            <div className="py-8 text-center text-[11.5px] text-[var(--admin-text-muted)]">Chargement…</div>
          ) : historyItems.length === 0 ? (
            <div className="py-8 text-center text-[11.5px] text-[var(--admin-text-muted)]">
              Aucune session enregistrée.
            </div>
          ) : (
            <div className="space-y-1.5">
              {historyItems.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-start gap-2 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] bg-white px-2.5 py-2 transition hover:border-[var(--admin-accent)] ${
                    s.id === sessionId ? 'ring-1 ring-[var(--admin-accent)]' : ''
                  }`}
                >
                  <button
                    onClick={() => resumeSession(s.id)}
                    className="flex-1 min-w-0 text-left"
                  >
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
                    onClick={() => deleteSession(s.id)}
                    title="Supprimer"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--admin-text-faint)] opacity-0 transition hover:bg-[var(--admin-danger-soft)] hover:text-[var(--admin-danger)] group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!minimized && !historyOpen && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto bg-[var(--admin-bg-subtle)] px-3 py-3"
          >
            {hydrating ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="mt-2 text-[11.5px] text-[var(--admin-text-muted)]">Restauration de la session…</p>
              </div>
            ) : messages.length === 0 ? (
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
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onConfirm={() => {
                      // Echo back the precise confirmKey if the backend gave us one;
                      // fall back to the wildcard for legacy confirm payloads.
                      const key = msg.confirmKey ?? '*';
                      const newConfirm = { ...pendingConfirmations, [key]: true };
                      setPendingConfirmations(newConfirm);
                      const lastUser = messages.filter((m) => m.role === 'user').pop();
                      if (lastUser?.text) {
                        sendMessage(lastUser.text, newConfirm);
                      }
                    }}
                  />
                ))}
                {streaming && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-[var(--admin-radius-lg)] bg-white px-3 py-2 ring-1 ring-[var(--admin-border)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-text-muted)]" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-bg)] p-2.5">
            <div className="flex items-end gap-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2.5 py-1.5 transition focus-within:border-[var(--admin-accent)] focus-within:ring-2 focus-within:ring-[var(--admin-accent-ring)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Dis-moi quoi faire…"
                disabled={streaming}
                rows={1}
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[var(--admin-text)] placeholder:text-[var(--admin-text-faint)] focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
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
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onConfirm,
}: {
  msg: SuperAgentMessage;
  onConfirm: () => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--admin-radius-lg)] rounded-br-sm bg-[var(--admin-chrome)] px-3 py-2 text-[12.5px] leading-relaxed text-white">
          <div className="whitespace-pre-wrap">{msg.text}</div>
        </div>
      </div>
    );
  }

  if (msg.role === 'system') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-[var(--admin-radius-lg)] border border-[var(--admin-warning)]/25 bg-[var(--admin-warning-soft)] px-3 py-2 text-[12px] leading-relaxed text-[#92400e]">
          {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
          {msg.confirmRequired && (
            <button
              onClick={onConfirm}
              className="mt-2 rounded-[var(--admin-radius-sm)] bg-[var(--admin-warning)] px-2.5 py-1 text-[11px] font-medium text-white transition hover:opacity-90"
            >
              {msg.confirmTool ? `Confirmer ${msg.confirmTool}` : 'Confirmer l’action'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'tool') {
    const out = msg.toolOutput ? JSON.stringify(msg.toolOutput, null, 2) : null;
    const inp = msg.toolInput ? JSON.stringify(msg.toolInput, null, 2) : null;
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
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-[var(--admin-radius-lg)] rounded-bl-sm border border-[var(--admin-border)] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[var(--admin-text)]">
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
    </div>
  );
}
