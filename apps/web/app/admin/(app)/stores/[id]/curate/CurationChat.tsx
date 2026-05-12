'use client';

/**
 * CurationChat — client side of the per-store curation copilot.
 *
 * Layout:
 *   ┌──────────────────────────────┬──────────────────────┐
 *   │ Session picker + scroll feed │  Catalog sidebar     │
 *   │ Tool cards inline            │  (live updates)      │
 *   │ Composer at bottom           │                      │
 *   └──────────────────────────────┴──────────────────────┘
 *
 * Streaming protocol: POST /api/agent/stores/{id}/curate with SSE response.
 * Events:
 *   - session       : { sessionId }                   announced once
 *   - thinking      : { text }                        live assistant prose
 *   - tool_call     : { id, name, input }             outgoing tool invocation
 *   - tool_result   : { id, name, output, summary, is_error }
 *   - message       : { text }                        final assistant text
 *   - done          : { text }                        end of turn
 *   - error         : { message }
 *
 * After every `tool_result` that mutates the catalog (add/remove/price/copy),
 * we re-fetch the right-side product list via /api/agent/stores/{id}/curate
 * helper endpoints; cheap because there's a single GET per mutation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Role = 'user' | 'assistant' | 'tool';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
  // Streaming-only: in-flight assistant text not yet persisted.
  streaming?: boolean;
}

interface SessionSummary {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

interface ProductRow {
  id: string;
  supplier: string;
  enriched_title: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
}

interface Props {
  storeId: string;
  storeSlug: string;
  initialSessions: SessionSummary[];
  initialSessionId: string | null;
  initialMessages: ChatMessage[];
  initialProducts: ProductRow[];
}

function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

function fmtEur(cents: number) {
  return (cents / 100).toFixed(2) + ' €';
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

export function CurationChat({
  storeId,
  storeSlug,
  initialSessions,
  initialSessionId,
  initialMessages,
  initialProducts,
}: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ── Scrolling: keep at bottom while streaming or on new messages.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  // ── Hydrate a different session when the picker changes.
  const loadSession = useCallback(
    async (id: string | null) => {
      setSessionId(id);
      setError(null);
      if (!id) {
        setMessages([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/agent/stores/${storeId}/curate/sessions/${id}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { messages: ChatMessage[] };
        setMessages(data.messages);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur chargement session');
      }
    },
    [storeId],
  );

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/stores/${storeId}/curate/sessions`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions);
      }
    } catch {
      // Non-fatal: the sessions list is a nice-to-have.
    }
  }, [storeId]);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch(`/admin/stores/${storeId}/curate?_p=1`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      // The admin page doesn't expose JSON; refresh via router.refresh below.
      void res;
    } catch {
      // ignore
    }
    router.refresh();
  }, [router, storeId]);

  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/stores/${storeId}/curate/sessions`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string };
      await loadSession(data.id);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création session');
    }
  }, [loadSession, refreshSessions, storeId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      setError(null);
      setStreaming(true);

      // Optimistic user bubble. UUID isn't strictly needed; we mark with a
      // temp id and let server state replace it on the next session load.
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

      let mutatedCatalog = false;
      let currentSessionId = sessionId;

      try {
        const res = await fetch(`/api/agent/stores/${storeId}/curate`, {
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
              setMessages((prev) => prev.map((m) =>
                m.id === tempAsstId
                  ? { ...m, content: t, streaming: parsed.type === 'thinking' }
                  : m,
              ));
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
              setMessages((prev) => prev.map((m) =>
                m.id === `tc-${d.id}`
                  ? {
                      ...m,
                      content: d.summary,
                      tool_output: d.output,
                      is_error: d.is_error,
                    }
                  : m,
              ));
              if (
                !d.is_error &&
                (d.name === 'add_product' ||
                  d.name === 'remove_product' ||
                  d.name === 'update_product_price' ||
                  d.name === 'rewrite_product_copy')
              ) {
                mutatedCatalog = true;
              }
            } else if (parsed.type === 'done') {
              setMessages((prev) => prev.map((m) =>
                m.id === tempAsstId ? { ...m, streaming: false } : m,
              ));
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
        if (mutatedCatalog) {
          await refreshProducts();
        }
      }
    },
    [refreshProducts, refreshSessions, sessionId, storeId, streaming],
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

  // ── Right column: live product catalog. Sync from props every render so a
  // router.refresh() pulls in the new rows from the server.
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const productById = useMemo(() => {
    const m = new Map<string, ProductRow>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  return (
    <>
      {/* CHAT COLUMN */}
      <section className="border border-zinc-200 bg-white rounded-xl flex flex-col h-[calc(100vh-220px)] min-h-[520px] overflow-hidden">
        {/* Session header */}
        <header className="px-5 py-3 border-b border-zinc-200 flex items-center gap-3">
          <div className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">Session</div>
          <select
            value={sessionId ?? ''}
            onChange={(e) => loadSession(e.target.value || null)}
            className="text-sm border border-zinc-200 rounded-lg px-2 py-1 bg-white"
          >
            {sessions.length === 0 && <option value="">Aucune session</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {fmtDate(s.updated_at)} · {s.message_count} msg
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startNewSession}
            className="text-sm px-3 py-1 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          >
            Nouvelle session
          </button>
          {sessionId && (
            <span className="ml-auto text-xs text-zinc-400 font-mono">{sessionId.slice(0, 8)}</span>
          )}
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-zinc-50/40">
          {messages.length === 0 && !streaming && (
            <div className="text-center text-sm text-zinc-400 mt-12">
              <p className="font-medium text-zinc-500">Aucun message.</p>
              <p className="mt-1">Essaie : <em>« ajoute 2 tapis de yoga premium »</em>, <em>« remonte la marge des produits sous 10 € »</em>, ou <em>« réécris le titre du #1 en plus haut de gamme »</em>.</p>
            </div>
          )}

          {messages.map((m, idx) => {
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
              <ToolCard
                key={m.id}
                message={m}
                onAdd={(supplier, supplierId) => {
                  const cmd = `Ajoute le produit ${supplier}:${supplierId}`;
                  void sendMessage(cmd);
                }}
                productById={productById}
                prevMessage={messages[idx - 1]}
              />
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Composer */}
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
      </section>

      {/* CATALOG COLUMN */}
      <aside className="border border-zinc-200 bg-white rounded-xl flex flex-col h-[calc(100vh-220px)] min-h-[520px] overflow-hidden">
        <header className="px-5 py-3 border-b border-zinc-200 flex items-center gap-2">
          <div className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">Catalogue</div>
          <span className="ml-auto text-xs text-zinc-500 font-medium">{products.length} produits</span>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-zinc-50/40">
          {products.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center mt-8">Aucun produit.</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-3 flex gap-3">
                <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-100 shrink-0">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900 line-clamp-2 leading-tight">
                    {p.enriched_title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    <span className={classNames(
                      'inline-block px-1.5 py-0.5 rounded-sm text-xs',
                      p.supplier === 'aliexpress' ? 'bg-orange-50 text-orange-700' :
                      p.supplier === 'cj' ? 'bg-blue-50 text-blue-700' :
                      'bg-zinc-100 text-zinc-600',
                    )}>{p.supplier}</span>
                    <span className="font-medium text-zinc-700">{fmtEur(p.price_cents)}</span>
                    <span className="text-green-600">+{fmtEur(p.price_cents - p.cost_cents)}</span>
                  </div>
                </div>
                {p.medusa_product_id && (
                  <Link
                    href={`https://medusa-production-656a.up.railway.app/app/products/${p.medusa_product_id}`}
                    target="_blank"
                    className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0 self-center"
                    title="Ouvrir dans Medusa"
                  >
                    ↗
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-zinc-200 text-xs text-zinc-400">
          <Link href={`/shop/${storeSlug}`} target="_blank" className="hover:underline">
            Voir le storefront →
          </Link>
        </div>
      </aside>
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

interface ToolCardProps {
  message: ChatMessage;
  onAdd: (supplier: string, supplierId: string) => void;
  productById: Map<string, ProductRow>;
  prevMessage: ChatMessage | undefined;
}

function ToolCard({ message, onAdd, productById, prevMessage }: ToolCardProps) {
  const [open, setOpen] = useState(true);
  const isError = message.is_error;
  const name = message.tool_name || 'tool';

  // Avoid empty noise: don't render a card if this is a tool_use that has
  // already been mirrored by a later tool_result row (same tool name + same
  // adjacent rendering position).
  void prevMessage;

  return (
    <div className={classNames(
      'rounded-xl border bg-white text-sm overflow-hidden',
      isError ? 'border-red-200' : 'border-zinc-200',
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-zinc-50"
      >
        <span className={classNames(
          'inline-block w-1.5 h-1.5 rounded-full',
          isError ? 'bg-red-500' : message.tool_output ? 'bg-emerald-500' : 'bg-amber-500',
        )} />
        <code className="font-mono text-xs text-zinc-700">{name}</code>
        <span className="ml-auto text-xs text-zinc-500 line-clamp-1">{message.content}</span>
        <span className="text-xs text-zinc-300">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-3">
          {/* Specialised renderers per tool */}
          {name === 'search_products' && Boolean(message.tool_output) && (
            <SearchResultsRenderer output={message.tool_output} onAdd={onAdd} />
          )}
          {name === 'rewrite_product_copy' && Boolean(message.tool_output) && (
            <RewriteRenderer output={message.tool_output} />
          )}
          {(name === 'add_product' || name === 'remove_product' || name === 'update_product_price') && Boolean(message.tool_output) && (
            <MutationRenderer name={name} output={message.tool_output} productById={productById} />
          )}

          {/* Raw input/output dump for debug */}
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-700">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">input</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs">
                  {JSON.stringify(message.tool_input ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">output</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs">
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

interface SearchCandidate {
  supplier: 'aliexpress' | 'cj';
  supplier_product_id: string;
  title: string;
  image_url: string;
  cost_cents: number;
  suggested_price_cents: number;
  margin_cents: number;
  orders?: number;
  score?: number;
  score_reasons?: string[];
}

function SearchResultsRenderer({
  output,
  onAdd,
}: {
  output: unknown;
  onAdd: (supplier: string, id: string) => void;
}) {
  const data = output as { candidates?: SearchCandidate[]; supplier_errors?: string[] };
  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    return (
      <div className="text-sm text-zinc-500">
        Aucun candidat retourné.
        {data.supplier_errors?.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
            {data.supplier_errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {candidates.map((c, idx) => (
        <div key={`${c.supplier}-${c.supplier_product_id}`} className="border border-zinc-200 rounded-lg p-3 flex gap-3 bg-white">
          <div className="w-14 h-14 rounded-md overflow-hidden bg-zinc-100 shrink-0">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium text-zinc-900 line-clamp-2 leading-tight">
              <span className="text-zinc-400 mr-1">#{idx + 1}</span>
              {c.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-zinc-500">
              <span className={classNames(
                'inline-block px-1.5 py-0.5 rounded-sm text-xs',
                c.supplier === 'aliexpress' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700',
              )}>{c.supplier}</span>
              <span>coût {fmtEur(c.cost_cents)}</span>
              <span className="text-zinc-700">prix {fmtEur(c.suggested_price_cents)}</span>
              <span className="text-green-600">+{fmtEur(c.margin_cents)}</span>
              {c.orders != null && <span>· {c.orders} cmd</span>}
            </div>
            <button
              type="button"
              onClick={() => onAdd(c.supplier, c.supplier_product_id)}
              className="mt-2 text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50"
            >
              Ajouter ce produit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RewriteRenderer({ output }: { output: unknown }) {
  const data = output as { before?: { title: string; description: string }; after?: { title: string; description: string } };
  if (!data.before || !data.after) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
        <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1">Avant</p>
        <p className="font-medium text-zinc-700">{data.before.title}</p>
        <p className="mt-1 text-zinc-500 line-clamp-6">{data.before.description}</p>
      </div>
      <div className="bg-emerald-50/40 rounded-lg p-3 border border-emerald-100">
        <p className="text-kicker uppercase tracking-cta text-emerald-700 mb-1">Après</p>
        <p className="font-medium text-zinc-900">{data.after.title}</p>
        <p className="mt-1 text-zinc-600 line-clamp-6">{data.after.description}</p>
      </div>
    </div>
  );
}

function MutationRenderer({
  name,
  output,
  productById,
}: {
  name: string;
  output: unknown;
  productById: Map<string, ProductRow>;
}) {
  const data = output as Record<string, unknown>;
  if (name === 'add_product') {
    return (
      <div className="text-xs text-zinc-700">
        <span className="font-medium">{String(data.title ?? '—')}</span>
        <span className="ml-2 text-zinc-500">{fmtEur(Number(data.price_cents ?? 0))} ({fmtEur(Number(data.margin_cents ?? 0))} marge)</span>
      </div>
    );
  }
  if (name === 'remove_product') {
    return (
      <div className="text-xs text-zinc-700">
        Supprimé : <span className="font-medium">{String(data.title ?? '—')}</span>
      </div>
    );
  }
  if (name === 'update_product_price') {
    const pid = String(data.product_id ?? '');
    const title = productById.get(pid)?.enriched_title || data.title || pid;
    return (
      <div className="text-xs text-zinc-700">
        <span className="font-medium">{String(title)}</span> :
        <span className="ml-1 text-zinc-500 line-through">{fmtEur(Number(data.previous_price_cents ?? 0))}</span>
        <span className="ml-1 text-zinc-900">→ {fmtEur(Number(data.new_price_cents ?? 0))}</span>
        <span className="ml-2 text-green-600">marge {fmtEur(Number(data.new_margin_cents ?? 0))}</span>
      </div>
    );
  }
  return null;
}
