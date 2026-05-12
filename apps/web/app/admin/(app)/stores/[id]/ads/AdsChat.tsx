'use client';

/**
 * AdsChat — client side of the ads copilot.
 *
 *   ┌──────────────────────────────┬──────────────────────────┐
 *   │ Session picker + chat feed   │ Variants catalog          │
 *   │ Tool cards inline            │ "Pousser" button per row  │
 *   │ Composer                     │ Modal: budget + days      │
 *   └──────────────────────────────┴──────────────────────────┘
 *
 * Streaming protocol mirrors CurationChat: `session`, `thinking`,
 * `tool_call`, `tool_result`, `message`, `done`, `error`.
 *
 * The "Pousser" modal is local component state — opens with a variant
 * pre-selected, asks daily budget + days, POSTs to /api/agent/stores/{id}/ads/push.
 * If the OAuth env var is missing for that channel, the response is
 * `status='draft'` and we surface a "Configurer OAuth" CTA next time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Role = 'user' | 'assistant' | 'tool';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  is_error?: boolean;
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

export interface VariantRow {
  id: string;
  product_id: string;
  product_title: string;
  product_image_url: string | null;
  channel: 'meta' | 'tiktok' | 'google';
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string | null;
  image_url: string | null;
}

interface Props {
  storeId: string;
  storeSlug: string;
  metaConfigured: boolean;
  tiktokConfigured: boolean;
  initialSessions: SessionSummary[];
  initialSessionId: string | null;
  initialMessages: ChatMessage[];
  initialVariants: VariantRow[];
}

function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
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

const CHANNEL_LABEL: Record<VariantRow['channel'], string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
};

export function AdsChat({
  storeId,
  storeSlug,
  metaConfigured,
  tiktokConfigured,
  initialSessions,
  initialSessionId,
  initialMessages,
  initialVariants,
}: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushVariant, setPushVariant] = useState<VariantRow | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    setVariants(initialVariants);
  }, [initialVariants]);

  const loadSession = useCallback(
    async (id: string | null) => {
      setSessionId(id);
      setError(null);
      if (!id) {
        setMessages([]);
        return;
      }
      try {
        const res = await fetch(`/api/agent/stores/${storeId}/ads/chat/sessions/${id}`, {
          cache: 'no-store',
        });
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
      const res = await fetch(`/api/agent/stores/${storeId}/ads/chat/sessions`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions);
      }
    } catch {
      // non-fatal
    }
  }, [storeId]);

  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/stores/${storeId}/ads/chat/sessions`, {
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

      let mutated = false;
      let currentSessionId = sessionId;

      try {
        const res = await fetch(`/api/agent/stores/${storeId}/ads/chat`, {
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
                  m.id === tempAsstId ? { ...m, content: t, streaming: parsed.type === 'thinking' } : m,
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
                    ? { ...m, content: d.summary, tool_output: d.output, is_error: d.is_error }
                    : m,
                ),
              );
              if (!d.is_error && (d.name === 'rewrite_hook' || d.name === 'generate_visual' || d.name === 'suggest_targeting')) {
                mutated = true;
              }
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
        if (mutated) router.refresh();
      }
    },
    [refreshSessions, router, sessionId, storeId, streaming],
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

  return (
    <>
      <section className="border border-zinc-200 bg-white rounded-xl flex flex-col h-[calc(100vh-260px)] min-h-[480px] overflow-hidden">
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

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-zinc-50/40">
          {messages.length === 0 && !streaming && (
            <div className="text-center text-sm text-zinc-400 mt-12">
              <p className="font-medium text-zinc-500">Aucun message.</p>
              <p className="mt-1">
                Essaie : <em>« réécris le hook Meta du produit X en plus émotionnel »</em>,{' '}
                <em>« génère un visuel pour la variante TikTok n°1 »</em>, ou <em>« propose un ciblage Meta pour le bestseller »</em>.
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
            return <ToolCard key={m.id} message={m} />;
          })}
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">{error}</div>
        )}

        <form onSubmit={onSubmit} className="border-t border-zinc-200 p-3 bg-white">
          <div className="flex gap-2 items-end">
            <textarea
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

      <aside className="border border-zinc-200 bg-white rounded-xl flex flex-col h-[calc(100vh-260px)] min-h-[480px] overflow-hidden">
        <header className="px-5 py-3 border-b border-zinc-200 flex items-center gap-2">
          <div className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">Variantes</div>
          <span className="ml-auto text-xs text-zinc-500 font-medium">{variants.length} hooks</span>
        </header>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-zinc-50/40">
          {variants.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center mt-8">Aucune variante. Génère-les par produit ci-dessous.</p>
          ) : (
            variants.map((v) => (
              <div key={v.id} className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-100 shrink-0">
                    {v.image_url || v.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.image_url || v.product_image_url || ''}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 line-clamp-2 leading-tight">{v.headline}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span
                        className={classNames(
                          'inline-block px-1.5 py-0.5 rounded-sm text-xs',
                          v.channel === 'meta'
                            ? 'bg-blue-50 text-blue-700'
                            : v.channel === 'tiktok'
                              ? 'bg-pink-50 text-pink-700'
                              : 'bg-zinc-100 text-zinc-600',
                        )}
                      >
                        {CHANNEL_LABEL[v.channel]}
                      </span>
                      <span className="line-clamp-1 text-zinc-400">{v.product_title}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPushVariant(v)}
                    disabled={v.channel === 'google'}
                    className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={v.channel === 'google' ? 'Google: copier dans Google Ads manuellement' : 'Pousser dans le gestionnaire'}
                  >
                    Pousser
                  </button>
                </div>
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

      {pushVariant && (
        <PushModal
          storeId={storeId}
          variant={pushVariant}
          metaConfigured={metaConfigured}
          tiktokConfigured={tiktokConfigured}
          onClose={() => setPushVariant(null)}
          onPushed={() => {
            setPushVariant(null);
            router.refresh();
          }}
        />
      )}
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

function ToolCard({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const isError = message.is_error;
  const name = message.tool_name || 'tool';

  return (
    <div
      className={classNames(
        'rounded-xl border bg-white text-sm overflow-hidden',
        isError ? 'border-red-200' : 'border-zinc-200',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-zinc-50"
      >
        <span
          className={classNames(
            'inline-block w-1.5 h-1.5 rounded-full',
            isError ? 'bg-red-500' : message.tool_output ? 'bg-emerald-500' : 'bg-amber-500',
          )}
        />
        <code className="font-mono text-xs text-zinc-700">{name}</code>
        <span className="ml-auto text-xs text-zinc-500 line-clamp-1">{message.content}</span>
        <span className="text-xs text-zinc-300">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-3">
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

function PushModal({
  storeId,
  variant,
  metaConfigured,
  tiktokConfigured,
  onClose,
  onPushed,
}: {
  storeId: string;
  variant: VariantRow;
  metaConfigured: boolean;
  tiktokConfigured: boolean;
  onClose: () => void;
  onPushed: () => void;
}) {
  const [budget, setBudget] = useState(25);
  const [days, setDays] = useState(7);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const configured =
    variant.channel === 'meta' ? metaConfigured : variant.channel === 'tiktok' ? tiktokConfigured : false;

  const onPush = useCallback(async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agent/stores/${storeId}/ads/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          channel: variant.channel,
          daily_budget_eur: budget,
          days,
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        error?: string;
        external_id?: string | null;
      };
      if (data.status === 'live') {
        setResult(`Campagne créée (id ${data.external_id ?? '—'}). Statut: PAUSED dans Business Manager.`);
        setTimeout(onPushed, 1200);
      } else if (data.status === 'draft') {
        setResult(`Brouillon enregistré: ${data.error ?? 'OAuth manquant'}.`);
        setTimeout(onPushed, 1200);
      } else {
        setError(data.error || 'Erreur inconnue');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setPending(false);
    }
  }, [budget, days, onPushed, storeId, variant.channel, variant.id]);

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-zinc-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">
              Pousser sur {CHANNEL_LABEL[variant.channel]}
            </p>
            <h3 className="mt-1 text-lg font-serif text-zinc-900 leading-snug line-clamp-2">{variant.headline}</h3>
            <p className="text-xs text-zinc-400 mt-1">{variant.product_title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {!configured ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-zinc-600">
              {CHANNEL_LABEL[variant.channel]} Ads OAuth n’est pas configuré sur cette instance. Configure
              les credentials puis reviens pousser la créa.
            </p>
            <Link
              href="/admin/settings#meta-ads"
              className="inline-block text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
            >
              Configurer {CHANNEL_LABEL[variant.channel]} Ads OAuth
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs text-zinc-500 font-medium">Budget quotidien (€)</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className="mt-1 w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Durée (jours)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 0)}
                className="mt-1 w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-400"
              />
            </div>
            <div className="text-xs text-zinc-400">
              Total: <span className="text-zinc-700 font-medium tabular-nums">{(budget * days).toFixed(0)} €</span>.
              La campagne est créée en statut <em>PAUSED</em> — tu l’actives manuellement dans Business
              Manager.
            </div>
            <button
              type="button"
              disabled={pending || budget <= 0 || days <= 0}
              onClick={onPush}
              className="w-full text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {pending ? 'Création…' : 'Pousser maintenant'}
            </button>
            {result && <p className="text-xs text-emerald-700">{result}</p>}
            {error && <p className="text-xs text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
