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
interface SessionSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
  streaming?: boolean;
  // Pinned shortlist info — when tool_name === 'shortlist_niche', the UI
  // renders a CTA card that pre-fills the form below.
  shortlist?: ShortlistPayload;
}

interface FeaturedProduct {
  supplier: 'aliexpress' | 'cj';
  supplier_product_id: string;
  title: string;
  image_url: string;
  supplier_url: string;
  cost_cents: number;
  suggested_price_cents: number;
  orders?: number;
  rating?: string | null;
  why_this_one?: string;
  pricing_rationale?: string;
  expected_aov_eur?: number;
}

interface MediaChannel {
  name: 'meta' | 'tiktok' | 'google' | 'pinterest';
  weight_pct: number;
  expected_cpm_eur?: number;
  expected_cpc_eur?: number;
  expected_cpa_eur?: number;
  rationale?: string;
}

interface MediaPlan {
  daily_budget_eur: number;
  channels: MediaChannel[];
  geo: {
    primary_countries: string[];
    emphasis?: string[];
    rationale?: string;
  };
  audience: {
    demographics: string;
    interests: string[];
    lookalike_seeds?: string[];
  };
  schedule: {
    best_hours_local: string[];
    best_days: string[];
    timezone?: string;
    rationale?: string;
  };
  expected_outcomes: {
    daily_orders_low: number;
    daily_orders_high: number;
    target_cpa_eur: number;
    target_roas: number;
    breakeven_note?: string;
  };
  top_hooks?: string[];
}

interface DesignProposal {
  preset:
    | 'editorial-serif'
    | 'tech-mono'
    | 'brutalist-luxe'
    | 'gen-z-bold'
    | 'lifestyle-warm';
  primary: string;
  accent: string;
  rationale: string;
}

interface ShortlistPayload {
  niche: string;
  rationale: string;
  saturation?: number;
  estimated_aov_eur?: number;
  suggested_store_name: string;
  target_audience?: string;
  featured_product?: FeaturedProduct;
  suggested_mode?: 'mono' | 'collection';
  suggested_template?:
    | 'auto'
    | 'mono'
    | 'collection-grid'
    | 'collection-editorial'
    | 'luxury-minimal'
    | 'gen-z-bold';
  media_plan?: MediaPlan;
  design_proposals?: DesignProposal[];
}

interface CostSummary {
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
}

interface Props {
  onApplyShortlist: (payload: ShortlistPayload) => void;
  mode: 'mono' | 'collection';
  onModeChange: (mode: 'mono' | 'collection') => void;
  language: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
  skipVideo: boolean;
  onSkipVideoChange: (skip: boolean) => void;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtEur(n: number) {
  if (!Number.isFinite(n)) return '0,00 €';
  return n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  });
}

export function NicheResearchCopilot({
  onApplyShortlist,
  mode,
  onModeChange,
  language,
  onLanguageChange,
  skipVideo,
  onSkipVideoChange,
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

  // Stick to bottom whenever messages or streaming flag change.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

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
                    <div className="max-w-[78%] bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm whitespace-pre-wrap">
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
                className="flex-1 resize-none text-sm bg-white text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-colors"
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
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
              >
                Envoyer
              </button>
              )}
            </div>
          </form>
        </div>

        {/* Right context column */}
        <aside className="px-4 py-4 space-y-4 bg-zinc-50/30 overflow-y-auto text-xs">
          {/* Sélecteurs rapides */}
          <div>
            <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
              Format
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onModeChange('mono')}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  mode === 'mono'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:bg-indigo-50'
                }`}
              >
                Mono
              </button>
              <button
                type="button"
                onClick={() => onModeChange('collection')}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  mode === 'collection'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:bg-indigo-50'
                }`}
              >
                Collection
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
              Langue
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onLanguageChange('fr')}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  language === 'fr'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:bg-indigo-50'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:bg-indigo-50'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {mode === 'mono' && (
            <div>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold">
                  Vidéo promo
                </span>
                <input
                  type="checkbox"
                  checked={!skipVideo}
                  onChange={(e) => onSkipVideoChange(!e.target.checked)}
                  className="accent-indigo-600 w-3.5 h-3.5"
                />
              </label>
            </div>
          )}

          {/* Comment ça marche */}
          <div className="border-t border-zinc-200 pt-3">
            <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
              Comment ça marche
            </p>
            <ul className="text-[11px] text-zinc-500 space-y-1.5 leading-snug">
              <li><span className="font-medium text-zinc-900">Recherche web</span> · Tavily + Perplexity</li>
              <li><span className="font-medium text-zinc-900">Meta Ads</span> · saturation 0-100 + angles</li>
              <li><span className="font-medium text-zinc-900">AliExpress + CJ</span> · supply + marge</li>
            </ul>
          </div>

          {/* Coût session */}
          <div className="border-t border-zinc-200 pt-3">
            <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
              Coût session
            </p>
            <div className="space-y-1 tabular-nums text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tokens i/o</span>
                <span className="text-zinc-900">
                  {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimation</span>
                <span className="font-semibold text-zinc-900">{fmtEur(cost.cost_eur)}</span>
              </div>
            </div>
          </div>
        </aside>
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

// ── Bits & pieces ────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

interface ResearchToolCardProps {
  message: ChatMessage;
  onApplyShortlist: (payload: ShortlistPayload) => void;
}

function ResearchToolCard({ message, onApplyShortlist }: ResearchToolCardProps) {
  const [open, setOpen] = useState(true);
  const isError = message.is_error;
  const name = message.tool_name || 'tool';

  // The shortlist card is a special-case: it doesn't get the collapsible
  // shell, it's a prominent CTA.
  if (name === 'shortlist_niche' && message.shortlist) {
    return <ShortlistCard payload={message.shortlist} onApply={onApplyShortlist} />;
  }

  return (
    <div
      className={`rounded-xl border bg-white text-sm overflow-hidden ${
        isError ? 'border-zinc-200' : 'border-zinc-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-zinc-50 transition-colors"
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isError
              ? 'bg-zinc-100'
              : message.tool_output
              ? 'bg-indigo-100'
              : 'bg-indigo-50'
          }`}
        />
        <code className="font-mono text-xs text-zinc-700">{name}</code>
        <span className="ml-auto text-xs text-zinc-500 line-clamp-1">{message.content}</span>
        <span className="text-xs text-zinc-300">{open ? '▾' : '▸'}</span>
      </button>

      {open && message.tool_output != null && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-3">
          {name === 'web_search' && <WebSearchRenderer output={message.tool_output} />}
          {name === 'ask_perplexity' && <PerplexityRenderer output={message.tool_output} />}
          {name === 'meta_ads_library' && <MetaLibraryRenderer output={message.tool_output} />}
          {(name === 'aliexpress_search' || name === 'cj_search') && (
            <SupplierRenderer output={message.tool_output} supplier={name === 'cj_search' ? 'cj' : 'aliexpress'} />
          )}
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-700">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">input</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full">
                  {JSON.stringify(message.tool_input ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">output</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full">
                  {JSON.stringify(message.tool_output ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ShortlistCard({
  payload,
  onApply,
}: {
  payload: ShortlistPayload;
  onApply: (p: ShortlistPayload) => void;
}) {
  // The picker selection is local to the card — we don't persist it in the
  // chat history. Defaults to the first proposal so a single-click flow still
  // works (operator sees the first design highlighted, clicks "Lancer").
  const [selectedDesign, setSelectedDesign] = useState<DesignProposal | null>(
    payload.design_proposals?.[0] ?? null,
  );
  const sat = payload.saturation;
  const verdictTone =
    sat == null
      ? 'border-indigo-200 bg-indigo-100/40'
      : sat > 70
      ? 'border-zinc-200 bg-zinc-100/40'
      : sat >= 30
      ? 'border-indigo-200 bg-indigo-50/40'
      : 'border-indigo-200 bg-indigo-100/40';
  const fp = payload.featured_product;
  const fpCost = fp ? (fp.cost_cents / 100).toFixed(2) : null;
  const fpPrice = fp ? (fp.suggested_price_cents / 100).toFixed(2) : null;
  const fpMargin = fp ? ((fp.suggested_price_cents - fp.cost_cents) / 100).toFixed(2) : null;
  const supplierTag = fp?.supplier === 'cj'
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : 'bg-zinc-100 text-zinc-700 border-zinc-200';

  return (
    <div className={`rounded-xl border ${verdictTone} px-5 py-4 space-y-4 min-w-0 max-w-full`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label text-zinc-500 font-medium">
          Recommandation IA
        </p>
        {sat != null && (
          <span className="text-xs text-zinc-500">Saturation {sat}/100</span>
        )}
      </div>
      <h3 className="font-semibold tracking-tight text-xl text-zinc-900">
        <em className="italic">{payload.niche}</em>
      </h3>
      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
        {payload.rationale}
      </p>

      {/* Featured product — image + supplier-grade meta. This is the
          piece the operator wants to actually SEE before committing
          to the niche. */}
      {fp && (
        <a
          href={fp.supplier_url}
          target="_blank"
          rel="noreferrer noopener"
          className="group flex gap-3 items-stretch bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors overflow-hidden"
        >
          <div className="w-28 sm:w-32 shrink-0 aspect-square bg-zinc-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fp.image_url}
              alt={fp.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-cta">
              <span className={`px-1.5 py-0.5 rounded-sm border ${supplierTag} font-semibold`}>
                {fp.supplier}
              </span>
              {fp.orders != null && (
                <span className="text-zinc-500 tabular-nums">{fp.orders} cmd</span>
              )}
              {fp.rating && (
                <span className="text-zinc-500 tabular-nums">★ {fp.rating}</span>
              )}
            </div>
            <p className="text-sm font-medium text-zinc-900 line-clamp-2 leading-tight">
              {fp.title}
            </p>
            <div className="flex items-baseline gap-3 text-xs tabular-nums">
              <span className="text-zinc-500">{fpCost} €</span>
              <span className="text-zinc-300">→</span>
              <span className="text-zinc-900 font-semibold">{fpPrice} €</span>
              <span className="text-indigo-600 font-medium">+{fpMargin} €</span>
              {fp.expected_aov_eur != null && (
                <span className="text-zinc-400 ml-auto">AOV ~{fp.expected_aov_eur} €</span>
              )}
            </div>
            {fp.pricing_rationale && (
              <p className="text-xs text-zinc-600 leading-snug line-clamp-2 italic">
                {fp.pricing_rationale}
              </p>
            )}
            {fp.why_this_one && (
              <p className="text-xs text-zinc-500 leading-snug line-clamp-2">{fp.why_this_one}</p>
            )}
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-white/70 rounded-lg p-3 border border-zinc-200">
          <p className="text-kicker uppercase tracking-cta text-zinc-400">Nom suggéré</p>
          <p className="mt-1 font-medium text-zinc-900">{payload.suggested_store_name}</p>
        </div>
        {payload.estimated_aov_eur != null && (
          <div className="bg-white/70 rounded-lg p-3 border border-zinc-200">
            <p className="text-kicker uppercase tracking-cta text-zinc-400">AOV estimé</p>
            <p className="mt-1 font-medium text-zinc-900">
              {payload.estimated_aov_eur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        )}
      </div>
      {payload.target_audience && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          <span className="font-medium text-zinc-700">Cible : </span>
          {payload.target_audience}
        </p>
      )}
      {payload.media_plan && <MediaPlanBlock plan={payload.media_plan} />}

      {payload.design_proposals && payload.design_proposals.length > 0 && (
        <DesignPickerBlock
          proposals={payload.design_proposals}
          selected={selectedDesign}
          onSelect={setSelectedDesign}
        />
      )}

      <div className="sticky bottom-0 -mx-5 -mb-4 px-5 pt-3 pb-4 bg-gradient-to-t from-white via-white to-white/0 backdrop-blur-sm">
        <button
          type="button"
          onClick={() =>
            onApply({
              ...payload,
              // Carry the picker's choice to the parent. If the agent
              // didn't propose any design we just send the payload as-is
              // — the store-creator will fall back to its default preset.
              design_proposals: selectedDesign ? [selectedDesign] : payload.design_proposals,
            })
          }
          className="w-full bg-zinc-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-cta"
        >
          Lancer cette niche →
        </button>
      </div>
    </div>
  );
}

const PRESET_LABELS: Record<DesignProposal['preset'], { label: string; tagline: string }> = {
  'editorial-serif':  { label: 'Editorial serif',  tagline: 'Magazine, italiques cinéma, blancs généreux.' },
  'tech-mono':        { label: 'Tech mono',        tagline: 'Vercel-grade, Geist, lettres précises.' },
  'brutalist-luxe':   { label: 'Brutalist luxe',   tagline: 'Off-White, blocs noirs, contraste max.' },
  'gen-z-bold':       { label: 'Gen-Z bold',       tagline: 'TikTok, saturé, énergique, grain.' },
  'lifestyle-warm':   { label: 'Lifestyle warm',   tagline: 'Aimé Leon Dore, sable, dimanche matin.' },
};

const PRESET_DISPLAY_FONT: Record<DesignProposal['preset'], string> = {
  'editorial-serif': "'Instrument Serif', Georgia, serif",
  'tech-mono':       "'Geist', system-ui, sans-serif",
  'brutalist-luxe':  "'PP Editorial New', 'Times New Roman', serif",
  'gen-z-bold':      "'Migra', 'Playfair Display', serif",
  'lifestyle-warm':  "'Fraunces', Georgia, serif",
};

function DesignPickerBlock({
  proposals,
  selected,
  onSelect,
}: {
  proposals: DesignProposal[];
  selected: DesignProposal | null;
  onSelect: (p: DesignProposal) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        Design system — choisis l&apos;ambiance
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {proposals.map((p) => {
          const isActive =
            selected?.preset === p.preset &&
            selected.primary === p.primary &&
            selected.accent === p.accent;
          const meta = PRESET_LABELS[p.preset];
          return (
            <button
              key={`${p.preset}-${p.primary}`}
              type="button"
              onClick={() => onSelect(p)}
              className={`text-left rounded-xl border bg-white overflow-hidden transition-all ${
                isActive
                  ? 'border-zinc-900 ring-2 ring-zinc-900/10 shadow-sm'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
              aria-pressed={isActive}
            >
              {/* Sample */}
              <div
                className="px-3 py-3 flex items-baseline gap-2"
                style={{ background: p.primary }}
              >
                <span
                  className="text-xl text-white leading-none"
                  style={{ fontFamily: PRESET_DISPLAY_FONT[p.preset], fontStyle: 'italic' }}
                >
                  Aa
                </span>
                <span
                  className="text-[11px] uppercase tracking-cta text-white/70 font-medium"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Sample
                </span>
                <span
                  className="ml-auto w-4 h-4 rounded-full border border-white/40"
                  style={{ background: p.accent }}
                  aria-hidden
                />
              </div>
              {/* Body */}
              <div className="px-3 py-2.5 space-y-1">
                <p className="text-[13px] font-semibold text-zinc-900 leading-tight">
                  {meta.label}
                </p>
                <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
                  {meta.tagline}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm border border-zinc-200"
                    style={{ background: p.primary }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums text-zinc-500 uppercase">{p.primary}</span>
                  <span
                    className="inline-block w-3 h-3 rounded-sm border border-zinc-200 ml-1.5"
                    style={{ background: p.accent }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums text-zinc-500 uppercase">{p.accent}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected?.rationale && (
        <p className="text-xs text-zinc-500 leading-relaxed italic">{selected.rationale}</p>
      )}
    </div>
  );
}

const CHANNEL_COLOR: Record<MediaChannel['name'], string> = {
  meta: 'bg-indigo-600',
  tiktok: 'bg-zinc-900',
  google: 'bg-indigo-300',
  pinterest: 'bg-zinc-400',
};

const CHANNEL_LABEL: Record<MediaChannel['name'], string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
  pinterest: 'Pinterest',
};

function MediaPlanBlock({ plan }: { plan: MediaPlan }) {
  const totalWeight = plan.channels.reduce((acc, c) => acc + c.weight_pct, 0) || 100;
  return (
    <div className="border-t border-zinc-200/70 pt-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label text-zinc-500 font-medium">
          Plan média
        </p>
        <span className="text-xs text-zinc-500 tabular-nums">
          {plan.daily_budget_eur.toLocaleString('fr-FR')} € / jour
        </span>
      </div>

      {/* Channel mix — stacked horizontal bar */}
      <div>
        <div className="flex h-2 rounded-full overflow-hidden bg-zinc-100">
          {plan.channels.map((c) => (
            <div
              key={c.name}
              className={CHANNEL_COLOR[c.name]}
              style={{ width: `${(c.weight_pct / totalWeight) * 100}%` }}
              title={`${CHANNEL_LABEL[c.name]} ${c.weight_pct}%`}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {plan.channels.map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${CHANNEL_COLOR[c.name]}`} />
              <span className="text-zinc-700 font-medium">{CHANNEL_LABEL[c.name]}</span>
              <span className="text-zinc-400 tabular-nums">{c.weight_pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/70 rounded-lg border border-zinc-200 p-3">
        <Metric label="CPA cible" value={`${plan.expected_outcomes.target_cpa_eur.toFixed(0)} €`} />
        <Metric label="ROAS cible" value={`×${plan.expected_outcomes.target_roas.toFixed(1)}`} />
        <Metric
          label="Cmd / jour"
          value={`${plan.expected_outcomes.daily_orders_low}–${plan.expected_outcomes.daily_orders_high}`}
        />
        <Metric
          label="Budget"
          value={`${plan.daily_budget_eur.toLocaleString('fr-FR')} €`}
        />
      </div>
      {plan.expected_outcomes.breakeven_note && (
        <p className="text-xs text-zinc-500 italic leading-snug">
          {plan.expected_outcomes.breakeven_note}
        </p>
      )}

      {/* Geo + audience side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-white/70 rounded-lg border border-zinc-200 p-3">
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Géo</p>
          <p className="font-medium text-zinc-900">{plan.geo.primary_countries.join(' · ')}</p>
          {plan.geo.emphasis && plan.geo.emphasis.length > 0 && (
            <p className="text-zinc-600 mt-1">
              Focus : {plan.geo.emphasis.join(', ')}
            </p>
          )}
          {plan.geo.rationale && (
            <p className="text-zinc-500 mt-1 leading-snug">{plan.geo.rationale}</p>
          )}
        </div>
        <div className="bg-white/70 rounded-lg border border-zinc-200 p-3">
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Audience</p>
          <p className="text-zinc-700 leading-snug">{plan.audience.demographics}</p>
          {plan.audience.interests.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.audience.interests.slice(0, 6).map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm border border-zinc-200 text-[10px] text-zinc-600"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white/70 rounded-lg border border-zinc-200 p-3 text-xs">
        <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Horaires</p>
        <p className="text-zinc-700">
          <span className="font-medium text-zinc-900">{plan.schedule.best_hours_local.join(' · ')}</span>
          <span className="text-zinc-400 mx-1.5">·</span>
          {plan.schedule.best_days.join(', ')}
          {plan.schedule.timezone && (
            <span className="text-zinc-400 ml-1.5">({plan.schedule.timezone})</span>
          )}
        </p>
        {plan.schedule.rationale && (
          <p className="text-zinc-500 mt-1 leading-snug">{plan.schedule.rationale}</p>
        )}
      </div>

      {/* Top hooks */}
      {plan.top_hooks && plan.top_hooks.length > 0 && (
        <div>
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-2">Hooks créatifs</p>
          <ul className="space-y-1.5">
            {plan.top_hooks.slice(0, 3).map((h, i) => (
              <li key={i} className="flex items-baseline gap-2 text-xs">
                <span className="text-zinc-400 tabular-nums shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                <span className="text-zinc-700 leading-snug">«&nbsp;{h}&nbsp;»</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-kicker uppercase tracking-cta text-zinc-400">{label}</p>
      <p className="mt-0.5 font-semibold text-zinc-900 tabular-nums">{value}</p>
    </div>
  );
}

function WebSearchRenderer({ output }: { output: unknown }) {
  const data = output as {
    query?: string;
    results?: Array<{ title: string; url: string; snippet: string; published?: string }>;
  };
  const results = data.results ?? [];
  if (results.length === 0) {
    return <p className="text-xs text-zinc-500">Aucun résultat.</p>;
  }
  return (
    <ul className="space-y-2">
      {results.map((r) => {
        let host = '';
        try {
          host = new URL(r.url).hostname.replace(/^www\./, '');
        } catch {
          host = r.url;
        }
        return (
          <li key={r.url} className="border border-zinc-200 rounded-lg p-3 bg-white">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-zinc-900 hover:underline line-clamp-2"
            >
              {r.title || host}
            </a>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span>{host}</span>
              {r.published && <span>· {new Date(r.published).toLocaleDateString('fr-FR')}</span>}
            </div>
            {r.snippet && <p className="mt-1 text-xs text-zinc-600 line-clamp-3">{r.snippet}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function PerplexityRenderer({ output }: { output: unknown }) {
  const data = output as { query?: string; answer?: string; citations?: string[] };
  if (!data.answer) return <p className="text-xs text-zinc-500">Réponse vide.</p>;
  return (
    <div className="space-y-2">
      <blockquote className="border-l-2 border-zinc-300 pl-3 text-sm text-zinc-700 whitespace-pre-wrap">
        {data.answer}
      </blockquote>
      {data.citations && data.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.citations.map((c, i) => {
            let host = '';
            try {
              host = new URL(c).hostname.replace(/^www\./, '');
            } catch {
              host = c;
            }
            return (
              <a
                key={`${c}-${i}`}
                href={c}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                [{i + 1}] {host}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetaLibraryRenderer({ output }: { output: unknown }) {
  const data = output as {
    saturation?: number;
    verdict?: 'go' | 'caution' | 'no-go';
    totalAds?: number;
    topAdvertisers?: Array<{ name: string; adCount: number }>;
    sampleCreatives?: Array<{ advertiser: string; previewImage?: string }>;
    angles?: string[];
  };
  const sat = data.saturation ?? 0;
  const verdict = data.verdict ?? 'caution';
  const tone =
    verdict === 'no-go'
      ? 'bg-zinc-100'
      : verdict === 'caution'
      ? 'bg-indigo-50'
      : 'bg-indigo-100';
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-700">Saturation</span>
          <span className="text-xs tabular-nums text-zinc-500">{sat}/100 · {verdict.toUpperCase()}</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${sat}%` }} />
        </div>
      </div>
      {data.sampleCreatives && data.sampleCreatives.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.sampleCreatives.slice(0, 3).map((c, i) => (
            <div
              key={`${c.advertiser}-${i}`}
              className="aspect-square rounded-md bg-zinc-100 overflow-hidden border border-zinc-200"
            >
              {c.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.previewImage} alt={c.advertiser} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 text-center p-1">
                  {c.advertiser}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data.topAdvertisers && data.topAdvertisers.length > 0 && (
        <ul className="space-y-1 text-xs">
          {data.topAdvertisers.slice(0, 3).map((a) => (
            <li key={a.name} className="flex justify-between text-zinc-600">
              <span className="truncate">{a.name}</span>
              <span className="text-zinc-400 tabular-nums shrink-0 ml-3">{a.adCount} ads</span>
            </li>
          ))}
        </ul>
      )}
      {data.angles && data.angles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.angles.map((a) => (
            <span
              key={a}
              className="inline-flex items-center px-2 py-0.5 rounded-full border border-zinc-200 text-xs text-zinc-600"
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierRenderer({
  output,
  supplier,
}: {
  output: unknown;
  supplier: 'aliexpress' | 'cj';
}) {
  const data = output as {
    query?: string;
    candidates?: Array<{
      supplier_product_id: string;
      title: string;
      image_url: string;
      supplier_url: string;
      cost_cents: number;
      suggested_price_cents: number;
      margin_cents: number;
      orders?: number;
      rating?: string | null;
    }>;
    error?: string;
  };
  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Aucun produit. {data.error && <span className="text-zinc-500">{data.error}</span>}
      </p>
    );
  }
  const tag = supplier === 'aliexpress' ? 'bg-zinc-100 text-zinc-700' : 'bg-indigo-50 text-indigo-700';
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-zinc-400 text-left">
            <th className="font-medium py-1 pr-2">Produit</th>
            <th className="font-medium py-1 px-2 text-right">Coût</th>
            <th className="font-medium py-1 px-2 text-right">Prix</th>
            <th className="font-medium py-1 px-2 text-right">Marge</th>
            <th className="font-medium py-1 pl-2 text-right">Cmd</th>
          </tr>
        </thead>
        <tbody className="text-zinc-700">
          {candidates.slice(0, 6).map((c) => (
            <tr key={c.supplier_product_id} className="border-t border-zinc-100">
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-zinc-100 shrink-0 overflow-hidden">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <a
                    href={c.supplier_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`inline-block px-1.5 py-0.5 rounded-sm shrink-0 ${tag}`}
                  >
                    {supplier}
                  </a>
                  <span className="truncate text-zinc-700">{c.title}</span>
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.cost_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.suggested_price_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-indigo-600">
                +{(c.margin_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-500">
                {c.orders ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Stored rows arrive with role 'tool' for both tool_call and tool_result
 * lines. The DB-only history doesn't carry a separate "shortlist" event,
 * so on hydrate we look at tool_name === 'shortlist_niche' and pin the
 * payload onto the message so the special card renders.
 */
function rehydrate(raw: ChatMessage[]): ChatMessage[] {
  return raw.map((m) => {
    if (m.role === 'tool' && m.tool_name === 'shortlist_niche' && m.tool_output) {
      const sl = m.tool_output as Partial<ShortlistPayload>;
      if (sl && sl.niche && sl.suggested_store_name && sl.rationale) {
        return {
          ...m,
          shortlist: {
            niche: sl.niche,
            rationale: sl.rationale,
            suggested_store_name: sl.suggested_store_name,
            saturation: sl.saturation,
            estimated_aov_eur: sl.estimated_aov_eur,
            target_audience: sl.target_audience,
            featured_product: sl.featured_product,
            suggested_mode: sl.suggested_mode,
            suggested_template: sl.suggested_template,
            media_plan: sl.media_plan,
          },
        };
      }
    }
    return m;
  });
}

export type { ShortlistPayload };
