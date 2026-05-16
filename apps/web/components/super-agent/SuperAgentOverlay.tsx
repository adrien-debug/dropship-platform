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
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
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
            };

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
    [pendingConfirmations],
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
          <kbd className="mr-1 hidden rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/55 ring-1 ring-white/10 sm:inline-block">
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

      {!minimized && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto bg-[var(--admin-bg-subtle)] px-3 py-3"
          >
            {messages.length === 0 ? (
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
                      const newConfirm = { ...pendingConfirmations, ['*']: true };
                      setPendingConfirmations(newConfirm);
                      const lastUser = messages.filter((m) => m.role === 'user').pop();
                      if (lastUser?.text) {
                        sendMessage(`Confirme : ${lastUser.text}`, newConfirm);
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
              Confirmer l&apos;action
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
