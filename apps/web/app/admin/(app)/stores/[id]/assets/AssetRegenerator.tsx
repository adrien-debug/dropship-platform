'use client';

/**
 * Client component rendering one asset section (current preview, regen panel,
 * history strip). One instance per asset kind on the page. The SSE log lines
 * read the same `{type, message}` event shape as `/admin/stores/new`.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetKind } from '@/lib/agent/asset-regenerator';

interface RunLite {
  id: string;
  prompt: string | null;
  resultUrl: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  errorMessage: string | null;
  isCurrent: boolean;
  createdAt: string;
}

interface AgentEvent {
  type: 'step' | 'progress' | 'success' | 'error' | 'done';
  message: string;
  data?: Record<string, unknown>;
}

interface LogLine {
  id: number;
  type: AgentEvent['type'];
  message: string;
  ts: string;
}

const LABELS: Record<AssetKind, { title: string; hint: string }> = {
  hero: {
    title: 'Hero',
    hint: 'Plein cadre éditorial 16:9 servi en haut du storefront.',
  },
  cutout: {
    title: 'Cutout',
    hint: 'Produit centré sur fond studio sombre. Sert aussi de source à la vidéo promo.',
  },
  'lifestyle-1': {
    title: 'Lifestyle 1',
    hint: 'Premier moment de vie — contexte intérieur lumineux.',
  },
  'lifestyle-2': {
    title: 'Lifestyle 2',
    hint: 'Deuxième moment de vie — contexte extérieur ou alternatif.',
  },
  'lifestyle-3': {
    title: 'Lifestyle 3',
    hint: 'Troisième moment de vie — usage situé, distinct des deux précédents.',
  },
  promo: {
    title: 'Vidéo promo',
    hint: '5 secondes 9:16, image-to-video à partir du cutout.',
  },
};

function formatRunDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AssetRegenerator({
  storeId,
  kind,
  currentUrl,
  runs,
  referenceImageUrl,
}: {
  storeId: string;
  kind: AssetKind;
  currentUrl: string | null;
  runs: RunLite[];
  referenceImageUrl: string | null;
}) {
  const router = useRouter();
  const label = LABELS[kind];
  const isVideo = kind === 'promo';

  // Pre-fill the prompt textarea with the last used prompt, falling back to ''
  // so the user can write from scratch.
  const lastPrompt = runs.find((r) => r.prompt)?.prompt ?? '';

  const [panelOpen, setPanelOpen] = useState(false);
  const [prompt, setPrompt] = useState(lastPrompt);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingSet, startSetTransition] = useTransition();
  const counterRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logs.length]);

  const pushLog = (type: AgentEvent['type'], message: string) => {
    counterRef.current += 1;
    setLogs((prev) => [
      ...prev,
      {
        id: counterRef.current,
        type,
        message,
        ts: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
  };

  const launch = async () => {
    if (running) return;
    if (!referenceImageUrl) {
      setError('Aucune image produit de référence.');
      return;
    }
    setRunning(true);
    setError(null);
    setLogs([]);

    try {
      const res = await fetch(`/api/agent/stores/${storeId}/assets/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, customPrompt: prompt.trim() || undefined }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => '');
        throw new Error(`Erreur serveur (${res.status}). ${t}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as AgentEvent;
            pushLog(event.type, event.message);
            if (event.type === 'error') setError(event.message);
            if (event.type === 'done') {
              router.refresh();
            }
          } catch {
            /* ignore malformed SSE chunk */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setRunning(false);
    }
  };

  const setAsCurrent = (runId: string) => {
    setError(null);
    startSetTransition(async () => {
      try {
        const res = await fetch(`/api/agent/stores/${storeId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, kind }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  };

  const successRuns = runs.filter((r) => r.status === 'success' && r.resultUrl);

  return (
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-zinc-200/70 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            {kind}
          </p>
          <h3 className="mt-1 text-base font-serif text-zinc-900">{label.title}</h3>
          <p className="mt-1.5 text-xs text-zinc-500 max-w-2xl">{label.hint}</p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          disabled={running || !referenceImageUrl}
          className="bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {panelOpen ? 'Fermer' : 'Régénérer'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          {/* Current preview */}
          <div>
            <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-2">
              Version courante
            </p>
            {currentUrl ? (
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="block border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50 hover:border-zinc-400 transition-colors"
              >
                {isVideo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video
                    src={currentUrl}
                    muted
                    playsInline
                    controls
                    className="w-full aspect-square object-cover bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUrl}
                    alt={label.title}
                    className="w-full aspect-square object-cover"
                  />
                )}
              </a>
            ) : (
              <div className="border border-dashed border-zinc-200 rounded-lg aspect-square flex items-center justify-center text-xs text-zinc-400">
                Pas encore généré
              </div>
            )}
          </div>

          {/* Regen panel */}
          {panelOpen && (
            <div className="space-y-3">
              <div>
                <label className="block text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-1.5">
                  Prompt FLUX (anglais, sans texte/badges)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={running}
                  rows={5}
                  placeholder="Laisse vide pour laisser Claude rédiger un nouveau prompt..."
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono text-zinc-800 focus:outline-none focus:border-zinc-900 disabled:bg-zinc-50"
                />
                <p className="mt-1 text-kicker text-zinc-400">
                  Vide = Claude réécrit le prompt à partir du produit et de la niche.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={launch}
                  disabled={running || !referenceImageUrl}
                  className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {running ? 'Génération en cours…' : 'Lancer'}
                </button>
                {error && <span className="text-xs text-red-600">{error}</span>}
              </div>

              {logs.length > 0 && (
                <div className="border border-zinc-200 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs max-h-56 overflow-y-auto p-3 space-y-1">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className={
                        l.type === 'error'
                          ? 'text-red-400'
                          : l.type === 'success'
                          ? 'text-emerald-400'
                          : l.type === 'step'
                          ? 'text-zinc-100'
                          : 'text-zinc-400'
                      }
                    >
                      <span className="text-zinc-500">[{l.ts}]</span> {l.message}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* History strip */}
        <div>
          <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-2">
            Historique des runs ({runs.length})
          </p>
          {runs.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">Aucune régénération enregistrée.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {runs.slice(0, 5).map((r) => {
                const usable = r.status === 'success' && r.resultUrl;
                return (
                  <div
                    key={r.id}
                    className={`border rounded-lg overflow-hidden bg-white transition-colors ${
                      r.isCurrent ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200'
                    }`}
                  >
                    <div className="aspect-square bg-zinc-100 relative">
                      {usable ? (
                        isVideo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <video
                            src={r.resultUrl!}
                            muted
                            playsInline
                            className="w-full h-full object-cover bg-black"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.resultUrl!}
                            alt={`Run du ${formatRunDate(r.createdAt)}`}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                          {r.status === 'error' ? 'Échec' : r.status === 'running' ? 'En cours…' : '—'}
                        </div>
                      )}
                      {r.isCurrent && (
                        <span className="absolute top-1.5 left-1.5 bg-zinc-900 text-white text-kicker uppercase tracking-cta px-1.5 py-0.5 rounded">
                          Courant
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-xs text-zinc-700 leading-snug">
                        Run du {formatRunDate(r.createdAt)}
                      </p>
                      {r.prompt && (
                        <p
                          className="text-kicker text-zinc-400 line-clamp-2"
                          title={r.prompt}
                        >
                          {r.prompt}
                        </p>
                      )}
                      {r.errorMessage && (
                        <p className="text-kicker text-red-600 line-clamp-2" title={r.errorMessage}>
                          {r.errorMessage}
                        </p>
                      )}
                      {usable && !r.isCurrent && (
                        <button
                          type="button"
                          onClick={() => setAsCurrent(r.id)}
                          disabled={pendingSet}
                          className="w-full text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-2 py-1.5 rounded transition-colors disabled:opacity-40"
                        >
                          {pendingSet ? '…' : 'Définir comme courant'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {successRuns.length === 0 && runs.length > 0 && (
            <p className="mt-2 text-kicker text-zinc-400">
              Aucun run réussi pour le moment.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
