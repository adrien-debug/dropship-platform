'use client';

import { apiFetch } from '@/lib/client-fetch';

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

interface ShortlistPayload {
  niche: string;
  rationale: string;
  saturation?: number;
  estimated_aov_eur?: number;
  suggested_store_name: string;
  target_audience?: string;
}

interface CostSummary {
  input_tokens: number;
  output_tokens: number;
  cost_eur: number;
}

interface Props {
  onApplyShortlist: (payload: ShortlistPayload) => void;
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

export function NicheResearchCopilot({ onApplyShortlist }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostSummary>({ input_tokens: 0, output_tokens: 0, cost_eur: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
      try {
        const res = await apiFetch('/api/agent/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId ?? undefined, message: text }),
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
        setError(e instanceof Error ? e.message : 'Erreur SSE');
      } finally {
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
      <header className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between gap-4">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            Pré-création · Recherche IA
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
            <em className="italic">Copilote</em> de niches.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sessionId ?? ''}
            onChange={(e) => loadSession(e.target.value || null)}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1 bg-white max-w-[240px]"
          >
            <option value="">Nouvelle session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {fmtDate(s.updated_at)} · {s.preview?.slice(0, 40) ?? '—'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startNewSession}
            className="text-sm px-3 py-1 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          >
            Nouvelle
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] items-stretch">
        {/* Chat column — viewport-relative height so the scroll area
            adapts to the screen instead of being clipped by the parent
            overflow-hidden when the sidebar grows longer.
            min-w-0 is critical: without it, long URLs / JSON blocks inside
            <pre> elements force the grid track to grow past the viewport,
            shoving the composer and the "Lancer cette niche" CTA off-screen. */}
        <div className="flex flex-col min-w-0 h-[calc(100dvh-260px)] min-h-[480px] max-h-[820px] border-r border-zinc-200/70">
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
                    <div className="max-w-[78%] bg-zinc-900 text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm whitespace-pre-wrap">
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
            <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
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
                placeholder="Demande quelque chose… (Cmd+Enter pour envoyer)"
                rows={2}
                disabled={streaming}
                className="flex-1 resize-none text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {streaming ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>

        {/* Right context column — scrolls internally when content is taller
            than the chat column it stretches against. */}
        <aside className="px-5 py-5 space-y-5 bg-zinc-50/30 overflow-y-auto">
          <div>
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium mb-2">
              Comment ça marche
            </p>
            <ul className="text-xs text-zinc-600 space-y-2 leading-relaxed">
              <li>
                <span className="font-medium text-zinc-800">Recherche web</span> via Tavily &
                Perplexity pour les tendances, l&apos;AOV et les concurrents.
              </li>
              <li>
                <span className="font-medium text-zinc-800">Meta Ads Library</span> pour scorer la
                saturation publicitaire (0-100) et lister les angles.
              </li>
              <li>
                <span className="font-medium text-zinc-800">AliExpress & CJ</span> pour vérifier
                que la supply existe et que la marge tient.
              </li>
            </ul>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium mb-2">
              Coût de la session
            </p>
            <div className="text-sm text-zinc-700 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tokens (in / out)</span>
                <span className="text-zinc-800">
                  {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimation</span>
                <span className="font-medium text-zinc-900">{fmtEur(cost.cost_eur)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 leading-relaxed">
            <p className="font-medium text-zinc-700 mb-1">Astuce</p>
            <p>
              Lorsque l&apos;IA propose une niche, clique sur <em>« Lancer cette niche »</em> pour
              pré-remplir le formulaire ci-dessous. Tu pourras ensuite ajuster avant de lancer la
              création.
            </p>
          </div>

          {messageCount > 0 && (
            <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-400">
              {messageCount} message{messageCount > 1 ? 's' : ''} · session {sessionId?.slice(0, 8)}
            </div>
          )}
        </aside>
      </div>
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
        isError ? 'border-red-200' : 'border-zinc-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-zinc-50"
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isError
              ? 'bg-red-500'
              : message.tool_output
              ? 'bg-emerald-500'
              : 'bg-amber-500'
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
  const sat = payload.saturation;
  const verdictTone =
    sat == null
      ? 'border-emerald-200 bg-emerald-50/40'
      : sat > 70
      ? 'border-red-200 bg-red-50/40'
      : sat >= 30
      ? 'border-amber-200 bg-amber-50/40'
      : 'border-emerald-200 bg-emerald-50/40';
  return (
    <div className={`rounded-xl border ${verdictTone} px-5 py-4 space-y-3 min-w-0 max-w-full`}>
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
      <button
        type="button"
        onClick={() => onApply(payload)}
        className="w-full bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-cta"
      >
        Lancer cette niche →
      </button>
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
      ? 'bg-red-500'
      : verdict === 'caution'
      ? 'bg-amber-500'
      : 'bg-emerald-500';
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
        Aucun produit. {data.error && <span className="text-red-600">{data.error}</span>}
      </p>
    );
  }
  const tag = supplier === 'aliexpress' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700';
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
              <td className="py-1.5 px-2 text-right tabular-nums text-emerald-700">
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
          },
        };
      }
    }
    return m;
  });
}

export type { ShortlistPayload };
