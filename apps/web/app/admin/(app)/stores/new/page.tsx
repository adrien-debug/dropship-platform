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
  const [, setLogs] = useState<LogLine[]>([]);
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
    }).catch((e) => {
      console.error('[applyShortlist] launch failed', e);
      setError(e instanceof Error ? e.message : 'Erreur de lancement');
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Breadcrumb compact */}
      <div className="flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/admin/stores" className="text-zinc-400 hover:text-zinc-900 transition-colors">
            ← Stores
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">Nouveau store</span>
        </div>
        {(running || result || error) && (
          <RunBanner
            running={running}
            result={result}
            error={error}
            progress={progress}
            elapsed={elapsed}
            currentStep={currentStep}
            slug={result?.slug}
            onReset={reset}
          />
        )}
      </div>

      {/* Copilote plein écran — chat à gauche, sélecteurs à droite */}
      <NicheResearchCopilot
        onApplyShortlist={applyShortlist}
        mode={mode}
        onModeChange={setMode}
        language={language}
        onLanguageChange={setLanguage}
        skipVideo={skipVideo}
        onSkipVideoChange={setSkipVideo}
      />
    </div>
  );
}

function RunBanner({
  running,
  result,
  error,
  progress,
  elapsed,
  currentStep,
  slug,
  onReset,
}: {
  running: boolean;
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
  progress: number;
  elapsed: number;
  currentStep: string;
  slug?: string;
  onReset: () => void;
}) {
  if (result && slug) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-indigo-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> {result.storeName} en ligne
        </span>
        <Link
          href={`/shop/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          Ouvrir
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
        >
          Créer un autre
        </button>
      </div>
    );
  }
  if (running) {
    return (
      <div className="flex flex-col items-end gap-0.5 text-xs text-zinc-500 max-w-[60vw]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
          <span className="tabular-nums">{progress}% · {elapsed}s</span>
        </div>
        {currentStep && (
          <span className="text-zinc-400 italic truncate max-w-full" title={currentStep}>
            {currentStep}
          </span>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <span className="text-xs text-zinc-500 truncate max-w-[420px]" title={error}>
        Erreur : {error}
      </span>
    );
  }
  return null;
}


export default function NewStorePage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Chargement…</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
