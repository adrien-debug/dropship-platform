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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 }}>
      {/* Breadcrumb compact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexShrink: 0 }}>
        <Link href="/admin/stores" style={{ color: 'var(--ct-text-muted)', textDecoration: 'none' }}>
          &larr; Stores
        </Link>
        <span style={{ color: 'var(--ct-text-faint)' }}>/</span>
        <span style={{ fontWeight: 500, color: 'var(--ct-text-primary)' }}>Nouveau store</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ct-accent-soft)', border: '1px solid var(--ct-border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ct-accent)' }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ct-text-primary)' }}>{result.storeName}</h2>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ct-text-muted)' }}>{result.productCount} produit{result.productCount > 1 ? 's' : ''} import&eacute;{result.productCount > 1 ? 's' : ''} &middot; pr&ecirc;t &agrave; vendre</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href={`/shop/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--ct-accent)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Ouvrir le store &rarr;
          </Link>
          <Link
            href="/admin/stores"
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--ct-border)', color: 'var(--ct-text-body)', fontSize: 13, fontWeight: 500, textDecoration: 'none', background: 'var(--ct-surface-1)' }}
          >
            Voir tous les stores
          </Link>
          <button
            type="button"
            onClick={onReset}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--ct-border)', color: 'var(--ct-text-muted)', fontSize: 13, fontWeight: 500, background: 'var(--ct-surface-1)', cursor: 'pointer' }}
          >
            Cr&eacute;er un autre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, border: '1px solid var(--ct-border)', borderRadius: 12, background: 'var(--ct-surface-0)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '10px 20px', borderBottom: '1px solid var(--ct-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {running ? (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ct-accent)', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ct-accent-strong)', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {running ? `Construction de « ${storeName} »` : `Erreur — « ${storeName} »`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {running && (
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-muted)', fontWeight: 500 }}>
              {percent}% &middot; {elapsed}s
            </span>
          )}
          {error && (
            <button
              type="button"
              onClick={onReset}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1px solid var(--ct-border)', color: 'var(--ct-text-muted)', background: 'var(--ct-surface-2)', cursor: 'pointer' }}
            >
              R&eacute;essayer
            </button>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ flexShrink: 0, height: 2, background: 'var(--ct-surface-3)' }}>
        <div
          style={{ height: '100%', background: 'var(--ct-accent)', transition: 'width 500ms', width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      {/* Étape courante */}
      {currentStep && (
        <div style={{ flexShrink: 0, padding: '8px 20px', borderBottom: '1px solid var(--ct-border-soft)', background: 'var(--ct-surface-1)' }}>
          <p style={{ fontSize: 12, color: 'var(--ct-text-body)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentStep}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ flexShrink: 0, padding: '12px 20px', background: 'var(--ct-accent-soft)', borderBottom: '1px solid var(--ct-border-accent)' }}>
          <p style={{ fontSize: 13, color: 'var(--ct-accent-strong)', fontWeight: 500 }}>Erreur de cr&eacute;ation</p>
          <p style={{ fontSize: 12, color: 'var(--ct-accent)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{error}</p>
        </div>
      )}

      {/* Logs en temps réel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 12 }}>
        {logs.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: 'var(--ct-text-faint)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingTop: 1 }}>{l.ts}</span>
            <span style={{
              color: l.type === 'error' ? 'var(--ct-accent-strong)' :
                     l.type === 'success' ? '#22c55e' :
                     l.type === 'step' ? 'var(--ct-text-primary)' :
                     'var(--ct-text-muted)',
              fontWeight: l.type === 'step' ? 500 : 400,
            }}>
              {l.type === 'step' && <span style={{ color: 'var(--ct-text-faint)', marginRight: 6 }}>&rsaquo;</span>}
              {l.message}
            </span>
          </div>
        ))}
        {running && logs.length === 0 && (
          <p style={{ color: 'var(--ct-text-faint)' }}>D&eacute;marrage&hellip;</p>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default function NewStorePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 13, color: 'var(--ct-text-muted)' }}>Chargement&hellip;</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
