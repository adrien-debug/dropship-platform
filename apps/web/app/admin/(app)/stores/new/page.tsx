'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { NicheResearchCopilot, type ShortlistPayload } from './NicheResearchCopilot';

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

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [mode, setMode] = useState<'mono' | 'collection'>('mono');
  const [maxProducts] = useState(10);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [skipVideo, setSkipVideo] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [result, setResult] = useState<{ slug: string; storeName: string; productCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const counterRef = useRef(0);
  const startTimeRef = useRef(0);

  // Prefill from query string (used by "recréer ce store" link)
  useEffect(() => {
    const n = searchParams.get('niche');
    const s = searchParams.get('name');
    if (n) setNiche(n);
    if (s) setStoreName(s);
  }, [searchParams]);

  // Elapsed timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const addLog = (event: AgentEvent) => {
    const line: LogLine = {
      id: counterRef.current++,
      type: event.type,
      message: event.message,
      ts: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev, line]);

    if (event.type === 'step' || event.type === 'progress') {
      setCurrentStep(event.message);
    }
    if (event.type === 'step') setProgress((p) => Math.min(p + 12, 80));
    if (event.type === 'progress' && event.data?.imported && event.data?.total) {
      const pct = Math.round((Number(event.data.imported) / Number(event.data.total)) * 100);
      setProgress(70 + Math.round(pct * 0.27));
    }
    if (event.type === 'success') {
      setProgress(100);
      setCurrentStep('');
    }
  };

  /**
   * Kick off store creation. Reads from local state by default, but an
   * `overrides` payload wins — that's how the shortlist card launches
   * directly without depending on React state propagation (setMode is
   * async, the value isn't there yet on the next render).
   */
  const launch = async (overrides?: {
    niche?: string;
    storeName?: string;
    mode?: 'mono' | 'collection';
    maxProducts?: number;
    language?: 'fr' | 'en';
    skipVideo?: boolean;
    designPreset?:
      | 'editorial-serif'
      | 'tech-mono'
      | 'brutalist-luxe'
      | 'gen-z-bold'
      | 'lifestyle-warm';
    primaryColor?: string;
    accentColor?: string;
    template?: string;
  }) => {
    const eff = {
      niche: overrides?.niche ?? niche,
      storeName: overrides?.storeName ?? storeName,
      mode: overrides?.mode ?? mode,
      maxProducts: overrides?.maxProducts ?? maxProducts,
      language: overrides?.language ?? language,
      skipVideo: overrides?.skipVideo ?? skipVideo,
      ...(overrides?.designPreset && { designPreset: overrides.designPreset }),
      ...(overrides?.primaryColor && { primaryColor: overrides.primaryColor }),
      ...(overrides?.accentColor && { accentColor: overrides.accentColor }),
      ...(overrides?.template && { template: overrides.template }),
    };
    if (!eff.niche.trim() || !eff.storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);
    setCurrentStep('Démarrage…');
    setElapsed(0);
    startTimeRef.current = Date.now();
    // Persist the values too so the form reflects what's running and the
    // operator can edit-and-retry if creation fails.
    setNiche(eff.niche);
    setStoreName(eff.storeName);
    setMode(eff.mode);

    try {
      const res = await apiFetch('/api/agent/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eff),
      });

      if (!res.ok || !res.body) {
        setError('Erreur serveur. Vérifie ANTHROPIC_API_KEY dans Réglages.');
        setRunning(false);
        return;
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
            addLog(event);
            if (event.type === 'success' && event.data) {
              setResult({
                slug: event.data.slug as string,
                storeName: event.data.storeName as string,
                productCount: event.data.productCount as number,
              });
            }
            if (event.type === 'error') setError(event.message);
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    }
    setRunning(false);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLogs([]);
    setProgress(0);
    setCurrentStep('');
    setElapsed(0);
    setNiche('');
    setStoreName('');
  };

  // Apply a shortlist payload from the research copilot — fires
  // create-store directly. Plain function (no useCallback) so it always
  // captures the freshest `launch` closure; the cost of an extra child
  // render is negligible compared to the bug of a stale closure that
  // silently no-ops.
  const applyShortlist = (payload: ShortlistPayload) => {
    const effMode: 'mono' | 'collection' =
      payload.suggested_mode === 'mono' || payload.suggested_mode === 'collection'
        ? payload.suggested_mode
        : 'mono';
    const niche = payload.niche?.trim();
    const storeName = payload.suggested_store_name?.trim();
    if (!niche || !storeName) {
      console.error('[applyShortlist] payload missing niche/storeName', payload);
      setError('Shortlist invalide (niche ou nom manquant). Relance une session.');
      return;
    }
    // The picker writes the operator's choice into design_proposals[0].
    // Everything downstream reads from that single entry — including the
    // store-creator UPDATE that freezes design_preset + palette in DB.
    const chosen = payload.design_proposals?.[0];
    // eslint-disable-next-line no-console
    console.info('[applyShortlist] launching create-store', {
      niche,
      storeName,
      mode: effMode,
      design: chosen ? `${chosen.preset} (${chosen.primary} / ${chosen.accent})` : 'default',
    });
    launch({
      niche,
      storeName,
      mode: effMode,
      ...(chosen && {
        designPreset: chosen.preset,
        primaryColor: chosen.primary,
        accentColor: chosen.accent,
      }),
      ...(payload.suggested_template && { template: payload.suggested_template }),
    }).catch((e) => {
      console.error('[applyShortlist] launch failed', e);
      setError(e instanceof Error ? e.message : 'Erreur de lancement');
    });
  };

  const isActive = running || !!result || !!error;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Breadcrumb compact */}
      <div className="flex items-center gap-2 text-xs shrink-0">
        <Link href="/admin/stores" className="text-admin-text-muted hover:text-admin-text transition-colors">
          ← Stores
        </Link>
        <span className="text-admin-text-faint">/</span>
        <span className="font-medium text-admin-text">Nouveau store</span>
      </div>

      {/* Quand la création tourne : plein écran dédié impossible à rater */}
      {isActive ? (
        <CreationScreen
          running={running}
          percent={progress}
          elapsed={elapsed}
          currentStep={currentStep}
          storeName={storeName}
          logs={logs}
          result={result}
          error={error}
          onReset={reset}
        />
      ) : (
        /* Copilote recherche de niche */
        <NicheResearchCopilot
          onApplyShortlist={applyShortlist}
          mode={mode}
          onModeChange={setMode}
          language={language}
          onLanguageChange={setLanguage}
          skipVideo={skipVideo}
          onSkipVideoChange={setSkipVideo}
          creationProgress={null}
        />
      )}
    </div>
  );
}



function CreationScreen({
  running,
  percent,
  elapsed,
  currentStep,
  storeName,
  logs,
  result,
  error,
  onReset,
}: {
  running: boolean;
  percent: number;
  elapsed: number;
  currentStep: string;
  storeName: string;
  logs: LogLine[];
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
  onReset: () => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (result) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-admin-accent/10 border border-admin-accent/20 flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-admin-accent">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-admin-text">{result.storeName}</h2>
          <p className="text-sm text-admin-text-muted">{result.productCount} produit{result.productCount > 1 ? 's' : ''} importé{result.productCount > 1 ? 's' : ''} · prêt à vendre</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/shop/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-admin-md bg-admin-text text-admin-text-inverse text-sm font-medium hover:bg-admin-chrome-soft transition-colors"
          >
            Ouvrir le store →
          </Link>
          <Link
            href="/admin/stores"
            className="px-5 py-2.5 rounded-admin-md border border-admin-border text-admin-text text-sm font-medium hover:bg-admin-bg-subtle transition-colors"
          >
            Voir tous les stores
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 rounded-admin-md border border-admin-border text-admin-text-muted text-sm font-medium hover:bg-admin-bg-subtle transition-colors"
          >
            Créer un autre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-admin-border rounded-admin-lg bg-admin-bg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-admin-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {running ? (
            <span className="w-2 h-2 rounded-full bg-admin-accent animate-pulse shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-admin-danger shrink-0" />
          )}
          <span className="text-sm font-semibold text-admin-text truncate">
            {running ? `Construction de « ${storeName} »` : `Erreur — « ${storeName} »`}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {running && (
            <span className="text-xs tabular-nums text-admin-text-muted font-medium">
              {percent}% · {elapsed}s
            </span>
          )}
          {error && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs px-3 py-1.5 rounded-admin-md border border-admin-border text-admin-text-muted hover:bg-admin-bg-subtle transition-colors"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="shrink-0 h-0.5 bg-admin-bg-muted">
        <div
          className="h-full bg-admin-text transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      {/* Étape courante */}
      {currentStep && (
        <div className="shrink-0 px-5 py-2 border-b border-admin-border-soft bg-admin-bg-subtle">
          <p className="text-xs text-admin-text-secondary italic truncate">{currentStep}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-5 py-3 bg-admin-danger-soft border-b border-red-100">
          <p className="text-sm text-admin-danger font-medium">Erreur de création</p>
          <p className="text-xs text-red-600/80 mt-0.5 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Logs en temps réel */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 font-mono text-[12px]">
        {logs.map((l) => (
          <div key={l.id} className="flex items-start gap-3">
            <span className="text-admin-text-faint tabular-nums shrink-0 pt-px">{l.ts}</span>
            <span className={
              l.type === 'error' ? 'text-admin-danger' :
              l.type === 'success' ? 'text-admin-success' :
              l.type === 'step' ? 'text-admin-text font-medium' :
              'text-admin-text-muted'
            }>
              {l.type === 'step' && <span className="text-admin-text-faint mr-1.5">›</span>}
              {l.message}
            </span>
          </div>
        ))}
        {running && logs.length === 0 && (
          <p className="text-admin-text-faint">Démarrage…</p>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default function NewStorePage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Chargement…</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
