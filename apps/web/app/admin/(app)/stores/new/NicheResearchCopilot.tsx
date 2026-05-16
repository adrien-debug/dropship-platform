'use client';

import { apiFetch } from '@/lib/client-fetch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * Pre-creation niche research copilot.
 *
 * Sits above the store-creation form on /admin/stores/new. The operator
 * chats with Claude (Sonnet 4.6) which has access to web search (Tavily),
 * Perplexity, Meta Ads Library, AliExpress + CJ supplier search and a
 * structured `shortlist_niche` tool. When Claude calls shortlist_niche we
 * surface a "Lancer cette niche" card; clicking it pre-fills the
 * downstream form (niche, store name, target audience hint) and scrolls
 * the form into view.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────┬────────────────────────┐
 *   │ Chat: messages + tool cards  │ Right-column context:  │
 *   │ Composer (Cmd+Enter)         │ - How it works         │
 *   │                              │ - Live cost preview    │
 *   └──────────────────────────────┴────────────────────────┘
 *
 * Stream protocol (SSE) — same envelope as the curation copilot:
 *   session, thinking, tool_call, tool_result, shortlist, message, done, error
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CopilotSidebar } from './niche-research/CopilotSidebar';
import { CreationProgressInline } from './niche-research/CreationProgressInline';
import { ResearchToolCard } from './niche-research/ResearchToolCard';
import { TypingDots } from './niche-research/renderers';
import type {
  ChatMessage,
  CostSummary,
  CreationProgress,
  SessionSummary,
  ShortlistPayload,
} from './niche-research/types';
import { fmtDate, rehydrate } from './niche-research/utils';

interface Props {
  onApplyShortlist: (payload: ShortlistPayload) => void;
  mode: 'mono' | 'collection';
  onModeChange: (mode: 'mono' | 'collection') => void;
  language: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
  skipVideo: boolean;
  onSkipVideoChange: (skip: boolean) => void;
  /**
   * When the parent's create-store SSE stream is running, the live state
   * is passed here so the copilot can render the progression inline in
   * the chat (instead of leaving the operator staring at silence).
   */
  creationProgress?: CreationProgress | null;
}

export function NicheResearchCopilot({
  onApplyShortlist,
  mode,
  onModeChange,
  language,
  onLanguageChange,
  skipVideo,
  onSkipVideoChange,
  creationProgress,
}: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostSummary>({ input_tokens: 0, output_tokens: 0, cost_eur: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
    // Marquer le dernier message assistant comme arrêté pour qu'il sorte du "thinking"
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  // Stick to bottom whenever messages, streaming flag, or live creation
  // progress change. The creationProgress object reference changes each
  // parent render while a store is being created — that's exactly when we
  // want the inline progress card to remain in view.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming, creationProgress]);

  // ── Session loaders ─────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/agent/research/sessions', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // Non-fatal: the picker can be empty.
    }
  }, []);

  const loadSession = useCallback(async (id: string | null) => {
    setSessionId(id);
    setError(null);
    if (!id) {
      setMessages([]);
      setCost({ input_tokens: 0, output_tokens: 0, cost_eur: 0 });
      return;
    }
    try {
      const res = await apiFetch(`/api/agent/research/sessions/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        messages: ChatMessage[];
        cost?: CostSummary;
      };
      setMessages(rehydrate(data.messages));
      if (data.cost) setCost(data.cost);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement session');
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const startNewSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/agent/research/sessions', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string };
      setSessionId(data.id);
      setMessages([]);
      setCost({ input_tokens: 0, output_tokens: 0, cost_eur: 0 });
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création session');
    }
  }, [refreshSessions]);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/agent/research/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Si on supprime la session active, on reset le chat
      setSessionId((prev) => (prev === id ? null : prev));
      setMessages((prev) => (sessionId === id ? [] : prev));
      setCost((prev) => (sessionId === id ? { input_tokens: 0, output_tokens: 0, cost_eur: 0 } : prev));
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression session');
    }
  }, [refreshSessions, sessionId]);

  // ── Send a chat turn ────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      setError(null);
      setStreaming(true);

      const tempUserId = `temp-u-${Date.now()}`;
      const tempAsstId = `temp-a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: 'user',
          content: text,
          tool_name: null,
          tool_input: null,
          tool_output: null,
        },
        {
          id: tempAsstId,
          role: 'assistant',
          content: '',
          tool_name: null,
          tool_input: null,
          tool_output: null,
          streaming: true,
        },
      ]);

      let currentSessionId = sessionId;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await apiFetch('/api/agent/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId ?? undefined, message: text }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const errBody = await res.text();
          throw new Error(errBody || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n\n');
          buf = lines.pop() ?? '';
          for (const block of lines) {
            const data = block.replace(/^data: /, '').trim();
            if (!data) continue;
            let parsed: { type: string; data: unknown };
            try {
              parsed = JSON.parse(data) as { type: string; data: unknown };
            } catch {
              continue;
            }

            if (parsed.type === 'session') {
              const sid = (parsed.data as { sessionId: string }).sessionId;
              currentSessionId = sid;
              setSessionId(sid);
            } else if (parsed.type === 'thinking' || parsed.type === 'message') {
              const t = (parsed.data as { text: string }).text || '';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAsstId
                    ? { ...m, content: t, streaming: parsed.type === 'thinking' }
                    : m,
                ),
              );
            } else if (parsed.type === 'tool_call') {
              const d = parsed.data as { id: string; name: string; input: unknown };
              setMessages((prev) => [
                ...prev,
                {
                  id: `tc-${d.id}`,
                  role: 'tool',
                  content: `Appel: ${d.name}`,
                  tool_name: d.name,
                  tool_input: d.input,
                  tool_output: null,
                },
              ]);
            } else if (parsed.type === 'tool_result') {
              const d = parsed.data as {
                id: string;
                name: string;
                output: unknown;
                summary: string;
                is_error: boolean;
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `tc-${d.id}`
                    ? {
                        ...m,
                        content: d.summary,
                        tool_output: d.output,
                        is_error: d.is_error,
                      }
                    : m,
                ),
              );
            } else if (parsed.type === 'shortlist') {
              const sl = parsed.data as ShortlistPayload;
              setMessages((prev) => [
                ...prev,
                {
                  id: `sl-${Date.now()}`,
                  role: 'tool',
                  content: `Shortlist: ${sl.niche}`,
                  tool_name: 'shortlist_niche',
                  tool_input: null,
                  tool_output: sl,
                  shortlist: sl,
                },
              ]);
            } else if (parsed.type === 'done') {
              setMessages((prev) =>
                prev.map((m) => (m.id === tempAsstId ? { ...m, streaming: false } : m)),
              );
            } else if (parsed.type === 'error') {
              const m = (parsed.data as { message: string }).message;
              setError(m);
            }
          }
        }
      } catch (e) {
        // Abort = utilisateur a cliqué Stop, pas une erreur à afficher
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setError(e instanceof Error ? e.message : 'Erreur SSE');
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        await refreshSessions();
        // Refresh cost preview after the turn settles.
        if (currentSessionId) {
          try {
            const r = await apiFetch(`/api/agent/research/sessions/${currentSessionId}`, {
              cache: 'no-store',
            });
            if (r.ok) {
              const data = (await r.json()) as { cost?: CostSummary };
              if (data.cost) setCost(data.cost);
            }
          } catch {
            // Non-fatal.
          }
        }
      }
    },
    [refreshSessions, sessionId, streaming],
  );

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setInput('');
      void sendMessage(text);
    },
    [input, sendMessage],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Entrée → envoyer · Shift+Entrée → nouvelle ligne
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const applyShortlist = useCallback(
    (payload: ShortlistPayload) => {
      onApplyShortlist(payload);
      // Scroll to the form section — the parent form lives in the same
      // page, identified by id="store-creation-form".
      const el = document.getElementById('store-creation-form');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [onApplyShortlist],
  );

  const messageCount = useMemo(() => messages.length, [messages]);

  return (
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
      <header className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 shrink-0">
            Copilote <em className="italic text-zinc-400">de niches</em>
          </h2>
          {messageCount > 0 && (
            <span className="text-[11px] text-zinc-400 truncate">
              {messageCount} msg · {sessionId?.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={sessionId ?? ''}
            onChange={(e) => loadSession(e.target.value || null)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white max-w-[200px]"
          >
            <option value="">Nouvelle session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {fmtDate(s.updated_at)} · {s.preview?.slice(0, 30) ?? '—'}
              </option>
            ))}
          </select>
          {sessionId && (
            <button
              type="button"
              onClick={() => setDeleteTargetId(sessionId)}
              title="Supprimer cette session"
              aria-label="Supprimer cette session"
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              <Trash2 size={13} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={startNewSession}
            title="Nouvelle session"
            aria-label="Nouvelle session"
            className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            +
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] items-stretch flex-1 min-h-0">
        {/* Chat column — fills the available height from parent flex-1 */}
        <div className="flex flex-col min-w-0 min-h-0 border-r border-zinc-200/70">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 space-y-4 bg-zinc-50/40"
          >
            {messages.length === 0 && !streaming && (
              <div className="text-center text-sm text-zinc-500 mt-12 max-w-md mx-auto">
                <p className="font-medium text-zinc-700">Aucun message.</p>
                <p className="mt-1.5 text-zinc-500">
                  Demande par exemple : <em>« trouve-moi une niche premium pour Noël pas trop saturée »</em>,
                  <em> « analyse la niche tapis de yoga »</em>,
                  ou <em>« qu&apos;est-ce qui marche actuellement en France pour les chats ? »</em>.
                </p>
              </div>
            )}
            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[78%] bg-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[78%] bg-white border border-zinc-200 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm text-zinc-800 whitespace-pre-wrap">
                      {m.content || (m.streaming ? <TypingDots /> : <span className="text-zinc-400">…</span>)}
                    </div>
                  </div>
                );
              }
              // tool
              return (
                <ResearchToolCard key={m.id} message={m} onApplyShortlist={applyShortlist} />
              );
            })}
            {creationProgress && <CreationProgressInline progress={creationProgress} />}
          </div>

          {error && (
            <div className="px-5 py-2 bg-zinc-100 border-t border-zinc-200 text-xs text-zinc-500">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="border-t border-zinc-200 p-3 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Demande quelque chose… (Entrée pour envoyer · Shift+Entrée pour saut de ligne)"
                rows={2}
                disabled={streaming}
                className="flex-1 resize-none text-sm bg-white text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-colors"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 shrink-0 transition-colors inline-flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-sm bg-white" aria-hidden />
                  Stop
                </button>
              ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
              >
                Envoyer
              </button>
              )}
            </div>
          </form>
        </div>

        {/* Right context column */}
        <CopilotSidebar
          mode={mode}
          onModeChange={onModeChange}
          language={language}
          onLanguageChange={onLanguageChange}
          skipVideo={skipVideo}
          onSkipVideoChange={onSkipVideoChange}
          cost={cost}
        />
      </div>
      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Supprimer cette session ?"
        description="L'historique de recherche sera définitivement perdu."
        confirmLabel="Supprimer"
        tone="destructive"
        onConfirm={() => {
          const id = deleteTargetId;
          setDeleteTargetId(null);
          if (id) deleteSession(id);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </section>
  );
}

export type { ShortlistPayload };
