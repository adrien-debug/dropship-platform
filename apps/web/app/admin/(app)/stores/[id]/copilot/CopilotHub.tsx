'use client';

import { apiFetch } from '@/lib/client-fetch';

/**
 * CopilotHub — client side of the per-store Copilote hub.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Mode pills [Recherche] [Curation] [Ads] [Médias] [Dev]       │
 *   │  Session ▾   [+ Nouvelle]                Auto-push (Dev) □    │
 *   ├────────────────────────────────────┬──────────────────────────┤
 *   │  Chat feed (60%)                   │  Contextual sidebar (40%) │
 *   │  - assistant + user + tool cards   │  - mode-specific          │
 *   │  - SSE typing dots                 │  - products / assets /    │
 *   │  - Cmd+Enter to send               │    git log / hints        │
 *   │  - confirm-push modal              │                           │
 *   └────────────────────────────────────┴──────────────────────────┘
 *
 * State:
 *   - mode: CopilotMode (persisted to localStorage per store)
 *   - sessionId: string | null (per mode)
 *   - sessions: SessionSummary[] grouped by mode in render
 *   - autoPush: boolean (only meaningful for Dev)
 *
 * SSE protocol:
 *   - session         : { sessionId, mode }
 *   - thinking        : { text }
 *   - tool_call       : { id, name, input }
 *   - tool_result     : { id, name, output, summary, is_error }
 *   - confirm_required: { tool, input, output }     dev mode push gate
 *   - message         : { text }
 *   - done            : { text }
 *   - error           : { message }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  ShoppingBag,
  Megaphone,
  Palette,
  Code2,
  Check,
  Pause,
  Rocket,
  Folder,
  FileText,
  type LucideIcon,
} from 'lucide-react';

export type CopilotMode = 'research' | 'curation' | 'ads' | 'medias' | 'dev';

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
  mode: CopilotMode;
  title: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

interface ProductRow {
  id: string;
  enriched_title: string;
  price_cents: number;
  image_url: string | null;
}

interface Props {
  storeId: string;
  storeSlug: string;
  storeName: string;
  initialMode: CopilotMode;
  initialSessionId: string | null;
  initialSessions: SessionSummary[];
  initialProducts: ProductRow[];
}

const MODE_LABELS: Record<CopilotMode, { Icon: LucideIcon; label: string; tagline: string }> = {
  research: { Icon: Target, label: 'Recherche', tagline: 'Trouver une niche' },
  curation: { Icon: ShoppingBag, label: 'Curation', tagline: 'Catalogue produits' },
  ads: { Icon: Megaphone, label: 'Ads', tagline: 'Hooks et ciblages' },
  medias: { Icon: Palette, label: 'Médias', tagline: 'Hero, lifestyle, promo' },
  dev: { Icon: Code2, label: 'Dev', tagline: 'Code de la plateforme' },
};

const MODE_ORDER: CopilotMode[] = ['research', 'curation', 'ads', 'medias', 'dev'];

function fmtEur(cents: number) {
  return (cents / 100).toFixed(2) + ' €';
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CopilotHub({
  storeId,
  storeSlug,
  storeName,
  initialMode,
  initialSessionId,
  initialSessions,
  initialProducts,
}: Props) {
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPush, setAutoPush] = useState(false);
  const [confirmModal, setConfirmModal] = useState<null | { tool: string; input: unknown }>(null);
  const [pendingPushMessage, setPendingPushMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ── Persist active mode per-store
  useEffect(() => {
    const key = `copilot-mode:${storeId}`;
    try {
      const saved = localStorage.getItem(key) as CopilotMode | null;
      if (saved && MODE_ORDER.includes(saved)) setMode(saved);
    } catch { /* ignore */ }
  }, [storeId]); // storeId is stable (from props), setMode is stable (useState setter)
  useEffect(() => {
    try { localStorage.setItem(`copilot-mode:${storeId}`, mode); } catch { /* ignore */ }
  }, [mode, storeId]);

  // ── Sessions filtered by mode
  const modeSessions = useMemo(
    () => sessions.filter((s) => s.mode === mode),
    [sessions, mode],
  );

  // When mode changes, pick the most recent session for that mode if any.
  useEffect(() => {
    if (modeSessions.length === 0) {
      setSessionId(null);
      setMessages([]);
      return;
    }
    const current = modeSessions.find((s) => s.id === sessionId);
    if (!current) {
      const first = modeSessions[0]!;
      setSessionId(first.id);
      void loadSession(first.id);
    }
  }, [mode, modeSessions, sessionId]); // loadSession omitted: stable useCallback declared below, adding it causes hoisting error (TS2448)

  // ── Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { sessions: SessionSummary[] };
        setSessions(data.sessions);
      }
    } catch { /* non-fatal */ }
  }, [storeId]);

  const loadSession = useCallback(async (id: string | null) => {
    setError(null);
    setSessionId(id);
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement session');
    }
  }, [storeId]);

  const startNewSession = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string };
      setSessionId(data.id);
      setMessages([]);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création session');
    }
  }, [mode, refreshSessions, storeId]);

  const sendMessage = useCallback(async (text: string, retryWithPush = false) => {
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
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId ?? undefined,
          mode,
          message: text,
          autoPushConfirmed: autoPush || retryWithPush,
        }),
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
          try { parsed = JSON.parse(data) as { type: string; data: unknown }; }
          catch { continue; }

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
              id: string; name: string; output: unknown; summary: string; is_error: boolean;
            };
            setMessages((prev) => prev.map((m) =>
              m.id === `tc-${d.id}`
                ? { ...m, content: d.summary, tool_output: d.output, is_error: d.is_error }
                : m,
            ));
          } else if (parsed.type === 'confirm_required') {
            const d = parsed.data as { tool: string; input: unknown };
            if (!autoPush) {
              setConfirmModal({ tool: d.tool, input: d.input });
              setPendingPushMessage(text);
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
    }
  }, [autoPush, mode, refreshSessions, sessionId, storeId, streaming]);

  const onSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    void sendMessage(text);
  }, [input, sendMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  const confirmPush = useCallback(async () => {
    setConfirmModal(null);
    if (pendingPushMessage) {
      // Re-send the same message with autoPushConfirmed=true. The agent
      // will replay the loop; in practice it will skip straight to git_push
      // because the prior turn already prepared the commit.
      const msg = `${pendingPushMessage}\n\n(L'utilisateur confirme: oui push.)`;
      setPendingPushMessage(null);
      await sendMessage(msg, true);
    }
  }, [pendingPushMessage, sendMessage]);

  const cancelPush = useCallback(() => {
    setConfirmModal(null);
    setPendingPushMessage(null);
  }, []);

  // ── Layout ───────────────────────────────────────────────────────────

  return (
    <>
      {/* Mode pills */}
      <div className="ct-card p-3" style={{ margin: 0 }}>
        <div className="ct-seg-track flex flex-wrap items-center gap-2">
          {MODE_ORDER.map((m) => {
            const meta = MODE_LABELS[m];
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`ct-seg-btn flex items-center gap-2${active ? ' active' : ''}`}
              >
                <meta.Icon size={16} strokeWidth={1.75} aria-hidden />
                <span className="font-medium">{meta.label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <select
              value={sessionId ?? ''}
              onChange={(e) => loadSession(e.target.value || null)}
              className="text-sm rounded-lg px-2 py-1 max-w-[260px]"
              style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}
            >
              {modeSessions.length === 0 && <option value="">Aucune session</option>}
              {modeSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || fmtDate(s.updated_at)} · {s.message_count} msg
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={startNewSession}
              className="ct-seg-btn text-sm px-3 py-1"
            >
              + Nouvelle
            </button>
            {mode === 'dev' && (
              <label className="flex items-center gap-1.5 text-xs ml-2 select-none" style={{ color: 'var(--ct-text-body)' }}>
                <input
                  type="checkbox"
                  checked={autoPush}
                  onChange={(e) => setAutoPush(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                <span>Auto-push</span>
              </label>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--ct-text-muted)' }}>
          {MODE_LABELS[mode].tagline}
          {mode === 'dev' && (
            <span className="ml-2 font-medium" style={{ color: 'var(--ct-accent)' }}>
              Mode développeur — agent avec accès lecture/écriture sur le repo.
            </span>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
        {/* CHAT */}
        <section className="ct-card flex flex-col min-h-[520px] lg:min-h-0 lg:h-full overflow-hidden" style={{ margin: 0 }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ background: 'var(--ct-surface-0)' }}>
            {messages.length === 0 && !streaming && (
              <div className="text-center text-sm mt-12" style={{ color: 'var(--ct-text-muted)' }}>
                <p className="font-medium flex items-center justify-center gap-2" style={{ color: 'var(--ct-text-body)' }}>
                  {(() => {
                    const ModeIcon = MODE_LABELS[mode].Icon;
                    return <ModeIcon size={16} strokeWidth={1.75} aria-hidden />;
                  })()}
                  {MODE_LABELS[mode].label}
                </p>
                <p className="mt-1">{getModeHint(mode, storeName)}</p>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[78%] rounded-2xl rounded-tr-md px-4 py-2.5 text-sm whitespace-pre-wrap" style={{ background: 'var(--ct-surface-3)', color: 'var(--ct-text-primary)' }}>
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[78%] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm whitespace-pre-wrap" style={{ background: 'var(--ct-surface-1)', border: '1px solid var(--ct-border)', color: 'var(--ct-text-primary)' }}>
                      {m.content || (m.streaming ? <TypingDots /> : <span style={{ color: 'var(--ct-text-muted)' }}>…</span>)}
                    </div>
                  </div>
                );
              }
              return <ToolCard key={m.id} message={m} />;
            })}
          </div>

          {error && (
            <div className="px-5 py-2 text-xs" style={{ background: 'var(--ct-surface-2)', borderTop: '1px solid var(--ct-border)', color: 'var(--ct-text-body)' }}>
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="p-3" style={{ borderTop: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Demande quelque chose à ${MODE_LABELS[mode].label}… (Cmd+Enter pour envoyer)`}
                rows={2}
                disabled={streaming}
                className="flex-1 resize-none text-sm rounded-lg px-3 py-2 focus:outline-none disabled:opacity-50 transition-colors"
                style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)', color: 'var(--ct-text-primary)' }}
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="ct-seg-btn primary text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {streaming ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </section>

        {/* SIDEBAR */}
        <aside className="ct-card flex flex-col min-h-[520px] lg:min-h-0 lg:h-full overflow-hidden" style={{ margin: 0 }}>
          <header className="px-5 py-3" style={{ borderBottom: '1px solid var(--ct-border)' }}>
            <div className="text-kicker uppercase tracking-cta font-medium text-xs" style={{ color: 'var(--ct-text-muted)' }}>
              Contexte
            </div>
            <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--ct-text-primary)' }}>
              {MODE_LABELS[mode].label}
            </p>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <Sidebar mode={mode} storeSlug={storeSlug} products={initialProducts} />
          </div>
        </aside>
      </div>

      {/* Confirm push modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="ct-card rounded-xl max-w-md w-full p-6 space-y-4" style={{ margin: 0, boxShadow: 'var(--ct-shadow-depth)' }}>
            <div>
              <p className="text-kicker uppercase tracking-cta text-xs font-medium" style={{ color: 'var(--ct-text-muted)' }}>
                Mode Dev
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--ct-text-primary)' }}>
                L&apos;agent veut pousser en prod
              </h3>
              <p className="mt-2 text-sm" style={{ color: 'var(--ct-text-body)' }}>
                Le copilote a préparé un commit et demande l&apos;autorisation de faire <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--ct-surface-3)', color: 'var(--ct-text-body)' }}>git push origin</code> sur la branche courante. Confirmer ?
              </p>
            </div>
            <div className="text-xs rounded-lg p-3 font-mono max-h-32 overflow-auto" style={{ background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}>
              {JSON.stringify(confirmModal.input ?? {}, null, 2)}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelPush}
                className="ct-seg-btn text-sm px-4 py-2"
              >
                Non, j&apos;annule
              </button>
              <button
                onClick={confirmPush}
                className="ct-seg-btn primary text-sm px-4 py-2"
              >
                Oui, pousser
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getModeHint(mode: CopilotMode, storeName: string): string {
  switch (mode) {
    case 'research':
      return 'Cherche une niche, valide la saturation Meta Ads, repère les fournisseurs avant de créer un nouveau store.';
    case 'curation':
      return `Ajoute, retire, repricer, réécrire la copy des produits de ${storeName}.`;
    case 'ads':
      return 'Liste tes variantes, réécris un hook, suggère un ciblage, estime un budget.';
    case 'medias':
      return 'Relance la génération d\'un asset (hero, lifestyle, promo), reviens à une version précédente.';
    case 'dev':
      return 'Décris ce que tu veux changer dans le code. L\'agent lit le repo, propose un patch, lance les tests et commit. Le push reste sous ta confirmation.';
  }
}

// ── Sidebar ─────────────────────────────────────────────────────────────

function Sidebar({
  mode,
  storeSlug,
  products,
}: {
  mode: CopilotMode;
  storeSlug: string;
  products: ProductRow[];
}) {
  if (mode === 'curation') {
    return (
      <div className="space-y-2">
        <p className="text-xs mb-2" style={{ color: 'var(--ct-text-body)' }}>{products.length} produits en catalogue</p>
        {products.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ct-text-muted)' }}>Aucun produit.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="rounded-lg p-2 flex gap-2" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)' }}>
              <div className="w-10 h-10 rounded overflow-hidden shrink-0" style={{ background: 'var(--ct-surface-3)' }}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-medium line-clamp-2 leading-tight" style={{ color: 'var(--ct-text-primary)' }}>{p.enriched_title}</p>
                <p className="mt-0.5" style={{ color: 'var(--ct-text-muted)' }}>{fmtEur(p.price_cents)}</p>
              </div>
            </div>
          ))
        )}
        <div className="pt-2">
          <Link href={`/shop/${storeSlug}`} target="_blank" className="text-xs hover:underline" style={{ color: 'var(--ct-text-muted)' }}>
            Voir le storefront →
          </Link>
        </div>
      </div>
    );
  }
  if (mode === 'ads') {
    return (
      <div className="text-sm space-y-2" style={{ color: 'var(--ct-text-body)' }}>
        <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Outils dispo</p>
        <ul className="text-xs list-disc pl-4 space-y-1">
          <li>list_variants — voir l&apos;état des ads</li>
          <li>rewrite_hook — réécrire headline + body</li>
          <li>generate_visual — visuel 1:1 via fal.ai</li>
          <li>suggest_targeting — age, intérêts, placements</li>
          <li>estimate_budget — CPM × jours</li>
        </ul>
        <p className="text-xs pt-2" style={{ color: 'var(--ct-text-muted)' }}>
          Astuce: démarre par &laquo; liste mes variantes &raquo;.
        </p>
      </div>
    );
  }
  if (mode === 'medias') {
    return (
      <div className="text-sm space-y-2" style={{ color: 'var(--ct-text-body)' }}>
        <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Slots d&apos;assets</p>
        <ul className="text-xs space-y-1">
          {['hero', 'cutout', 'lifestyle-1', 'lifestyle-2', 'lifestyle-3', 'promo'].map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ct-border-strong)' }} />
              <code className="text-xs">{k}</code>
            </li>
          ))}
        </ul>
        <p className="text-xs pt-2" style={{ color: 'var(--ct-text-muted)' }}>
          Astuce: &laquo; liste les assets &raquo; puis &laquo; régénère le hero &raquo;.
        </p>
      </div>
    );
  }
  if (mode === 'dev') {
    return (
      <div className="text-sm space-y-3" style={{ color: 'var(--ct-text-body)' }}>
        <div>
          <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Capacités</p>
          <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5" style={{ color: 'var(--ct-text-muted)' }}>
            <li>read_file / list_files / search_code</li>
            <li>write_file / apply_patch</li>
            <li>run_bash (whitelist: npm, npx, node, git, ls, cat, grep…)</li>
            <li>git_status / git_diff / git_commit</li>
            <li>git_push (confirmation requise)</li>
          </ul>
        </div>
        <div className="pt-3" style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
          <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Garde-fous</p>
          <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5" style={{ color: 'var(--ct-text-muted)' }}>
            <li>Lecture/écriture refusée sur .env*, .git/, node_modules/, .next/</li>
            <li>Commandes interdites: rm -rf, sudo, ssh, scp, mkfs…</li>
            <li>15 boucles max, 20 outils max par tour</li>
            <li>Pas de force-push, pas de --no-verify</li>
          </ul>
        </div>
        <div className="pt-3 text-xs" style={{ borderTop: '1px solid var(--ct-border-soft)', color: 'var(--ct-text-muted)' }}>
          Astuce: « ajoute un bouton de partage social sur la page produit ».
        </div>
      </div>
    );
  }
  // research
  return (
    <div className="text-sm space-y-2" style={{ color: 'var(--ct-text-body)' }}>
      <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Modes utiles</p>
      <ul className="text-xs list-disc pl-4 space-y-1">
        <li>web_search — Tavily</li>
        <li>ask_perplexity — synthèse + citations</li>
        <li>meta_ads_library — saturation</li>
        <li>aliexpress_search / cj_search</li>
        <li>shortlist_niche — recommandation finale</li>
      </ul>
      <p className="text-xs pt-2" style={{ color: 'var(--ct-text-muted)' }}>
        Astuce: démarre par &laquo; analyse la niche &lt;mot-clé&gt; &raquo;.
      </p>
    </div>
  );
}

// ── Tool cards ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)', animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)', animationDelay: '240ms' }} />
    </span>
  );
}

function ToolCard({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(true);
  const isError = !!message.is_error;
  const name = message.tool_name || 'tool';

  return (
    <div className="rounded-xl text-sm overflow-hidden" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: isError ? 'var(--ct-border)' : message.tool_output ? 'var(--ct-accent-soft)' : 'var(--ct-surface-3)' }} />
        <code className="font-mono text-xs" style={{ color: 'var(--ct-text-body)' }}>{name}</code>
        <span className="ml-auto text-xs line-clamp-1" style={{ color: 'var(--ct-text-muted)' }}>{message.content}</span>
        <span className="text-xs" style={{ color: 'var(--ct-border-strong)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
          <SpecialisedRenderer name={name} input={message.tool_input} output={message.tool_output} isError={isError} />
          <details className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>
            <summary className="cursor-pointer" style={{ color: 'var(--ct-text-body)' }}>Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>input</div>
                <pre className="mt-1 rounded p-2 overflow-x-auto font-mono text-xs" style={{ background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}>{JSON.stringify(message.tool_input ?? {}, null, 2)}</pre>
              </div>
              <div>
                <div className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>output</div>
                <pre className="mt-1 rounded p-2 overflow-x-auto font-mono text-xs" style={{ background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}>{JSON.stringify(message.tool_output ?? {}, null, 2)}</pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SpecialisedRenderer({
  name,
  input,
  output,
  isError,
}: {
  name: string;
  input: unknown;
  output: unknown;
  isError: boolean;
}) {
  if (!output) return null;
  const out = output as Record<string, unknown>;
  const inp = (input ?? {}) as Record<string, unknown>;

  if (name === 'read_file') {
    const content = typeof out.content === 'string' ? out.content : '';
    const preview = content.split('\n').slice(0, 20).join('\n');
    return (
      <div className="text-xs space-y-1">
        <p className="font-mono" style={{ color: 'var(--ct-text-body)' }}>{String(inp.path ?? '')}</p>
        <pre className="rounded p-3 overflow-x-auto font-mono text-xs" style={{ background: 'var(--ct-surface-0)', color: 'var(--ct-text-primary)' }}>{preview}{content.split('\n').length > 20 ? '\n…' : ''}</pre>
      </div>
    );
  }
  if (name === 'write_file' || name === 'apply_patch') {
    return (
      <div className="text-xs">
        <p className="font-mono" style={{ color: 'var(--ct-text-body)' }}>{String(inp.path ?? '')}</p>
        <p className="mt-1" style={{ color: 'var(--ct-text-muted)' }}>
          {name === 'apply_patch' ? 'Patch appliqué' : `Écriture (${out.bytes ?? '?'} octets)`}
        </p>
      </div>
    );
  }
  if (name === 'run_bash') {
    const stdout = typeof out.stdout === 'string' ? out.stdout : '';
    const stderr = typeof out.stderr === 'string' ? out.stderr : '';
    const exitCode = typeof out.exit_code === 'number' ? out.exit_code : '?';
    return (
      <div className="text-xs space-y-1">
        <p className="font-mono" style={{ color: 'var(--ct-text-body)' }}>$ {String(out.command ?? inp.command ?? '')}</p>
        {stdout && (
          <pre className="rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap" style={{ background: 'var(--ct-surface-0)', color: 'var(--ct-text-primary)' }}>{stdout}</pre>
        )}
        {stderr && (
          <pre className="rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap" style={{ background: 'var(--ct-surface-2)', color: 'var(--ct-text-muted)' }}>{stderr}</pre>
        )}
        <p className="font-medium" style={{ color: exitCode === 0 ? 'var(--ct-accent)' : 'var(--ct-text-muted)' }}>
          exit {exitCode}
        </p>
      </div>
    );
  }
  if (name === 'git_commit') {
    if (out.empty) return <p className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>Rien à commiter.</p>;
    return (
      <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--ct-accent-soft)', color: 'var(--ct-accent)' }}>
        <Check size={12} strokeWidth={2.5} aria-hidden />
        <span>commit</span>
        <code className="font-mono">{String(out.short_sha ?? '')}</code>
        <span>{String(out.message ?? '').slice(0, 60)}</span>
      </div>
    );
  }
  if (name === 'git_push') {
    if (out.confirm_required) {
      return (
        <p className="text-xs px-2 py-1 rounded inline-flex items-center gap-1.5" style={{ color: 'var(--ct-accent)', background: 'var(--ct-accent-soft)' }}>
          <Pause size={12} strokeWidth={2.5} aria-hidden />
          En attente de confirmation utilisateur.
        </p>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full" style={{ background: 'var(--ct-accent-soft)', color: 'var(--ct-accent)' }}>
        <Rocket size={12} strokeWidth={2} aria-hidden />
        pushed to {String(out.branch ?? 'origin')}
      </div>
    );
  }
  if (name === 'git_status' || name === 'git_diff') {
    const text = typeof out.porcelain === 'string' ? out.porcelain : typeof out.diff === 'string' ? out.diff : '';
    return (
      <pre className="rounded p-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap max-h-72" style={{ background: 'var(--ct-surface-0)', color: 'var(--ct-text-primary)' }}>{text || '(vide)'}</pre>
    );
  }
  if (name === 'search_code') {
    const matches = Array.isArray(out.matches) ? (out.matches as Array<{ file: string; line: number; content: string }>) : [];
    if (matches.length === 0) return <p className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>Aucun match.</p>;
    return (
      <div className="text-xs space-y-0.5 font-mono">
        {matches.slice(0, 12).map((m, i) => (
          <div key={i} className="truncate">
            <span style={{ color: 'var(--ct-text-muted)' }}>{m.file}:{m.line}</span>{' '}
            <span style={{ color: 'var(--ct-text-body)' }}>{m.content.trim()}</span>
          </div>
        ))}
        {matches.length > 12 && <p style={{ color: 'var(--ct-text-muted)' }}>…et {matches.length - 12} de plus</p>}
      </div>
    );
  }
  if (name === 'list_files') {
    const entries = Array.isArray(out.entries) ? (out.entries as Array<{ path: string; type: string }>) : [];
    return (
      <div className="text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto">
        {entries.slice(0, 30).map((e, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="inline-flex" style={{ color: 'var(--ct-text-muted)' }}>
              {e.type === 'dir' ? <Folder size={12} strokeWidth={1.75} aria-hidden /> : <FileText size={12} strokeWidth={1.75} aria-hidden />}
            </span>
            <span>{e.path}</span>
          </div>
        ))}
        {entries.length > 30 && <p style={{ color: 'var(--ct-text-muted)' }}>…et {entries.length - 30} de plus</p>}
      </div>
    );
  }
  if (isError && typeof out.error === 'string') {
    return <p className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>{out.error}</p>;
  }
  return null;
}
