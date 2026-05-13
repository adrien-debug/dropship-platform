'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Smartphone,
  Sparkles,
  PawPrint,
  HeartPulse,
  Dumbbell,
  Baby,
  Gamepad2,
  Leaf,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader, StatCard, StatusPill, type Tone } from '../../../_components/AdminUI';
import { NicheResearchCopilot, type ShortlistPayload } from './NicheResearchCopilot';

interface NicheValidationResult {
  saturation: number;
  verdict: 'go' | 'caution' | 'no-go';
  totalAds: number;
  topAdvertisers: Array<{ name: string; pageId?: string; adCount: number }>;
  sampleCreatives: Array<{
    adId?: string;
    advertiser: string;
    previewImage?: string;
    landingUrl?: string;
    startedAt?: string;
  }>;
  angles: string[];
  source: 'meta-html' | 'claude-fallback' | 'cache';
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

interface NichePreset {
  Icon: LucideIcon;
  label: string;
  value: string;
}

const NICHE_PRESETS: NichePreset[] = [
  { Icon: Home,       label: 'Home decor',         value: 'home decor' },
  { Icon: Smartphone, label: 'Phone accessories',  value: 'phone accessories' },
  { Icon: Sparkles,   label: 'Yoga & bien-être',   value: 'yoga wellness' },
  { Icon: PawPrint,   label: 'Animaux',            value: 'pet accessories' },
  { Icon: HeartPulse, label: 'Beauté',             value: 'beauty skincare' },
  { Icon: Dumbbell,   label: 'Fitness',            value: 'fitness equipment' },
  { Icon: Baby,       label: 'Bébé',               value: 'baby products' },
  { Icon: Gamepad2,   label: 'Gaming',             value: 'gaming accessories' },
  { Icon: Leaf,       label: 'Jardinage',          value: 'garden outdoor' },
  { Icon: Plane,      label: 'Voyage',             value: 'travel accessories' },
];

function FieldLabel({
  number,
  title,
  hint,
}: {
  number: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <span className="text-kicker uppercase tracking-label text-zinc-400 font-medium tabular-nums">
        {number}
      </span>
      <span className="text-sm font-medium text-zinc-900">{title}</span>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [mode, setMode] = useState<'mono' | 'collection'>('mono');
  const [maxProducts, setMaxProducts] = useState(10);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [skipVideo, setSkipVideo] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ slug: string; storeName: string; productCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<NicheValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const startTimeRef = useRef(0);
  const detailsEndRef = useRef<HTMLDivElement>(null);

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
    setTimeout(() => detailsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);

    if (event.type === 'step') setProgress((p) => Math.min(p + 12, 80));
    if (event.type === 'progress' && event.data?.imported && event.data?.total) {
      const pct = Math.round((Number(event.data.imported) / Number(event.data.total)) * 100);
      setProgress(70 + Math.round(pct * 0.27));
    }
    if (event.type === 'success') setProgress(100);
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
  }) => {
    const eff = {
      niche: overrides?.niche ?? niche,
      storeName: overrides?.storeName ?? storeName,
      mode: overrides?.mode ?? mode,
      maxProducts: overrides?.maxProducts ?? maxProducts,
      language: overrides?.language ?? language,
      skipVideo: overrides?.skipVideo ?? skipVideo,
    };
    if (!eff.niche.trim() || !eff.storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);
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
    setElapsed(0);
    setNiche('');
    setStoreName('');
    setShowDetails(false);
    setValidation(null);
    setValidationError(null);
  };

  const validateNiche = async () => {
    const term = niche.trim();
    if (!term || validating) return;
    setValidating(true);
    setValidationError(null);
    setValidation(null);
    try {
      const res = await apiFetch('/api/agent/niches/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: term, country: 'FR' }),
      });
      const body = (await res.json()) as NicheValidationResult & { error?: string };
      if (!res.ok) {
        setValidationError(body.error ?? 'Validation indisponible.');
      } else {
        setValidation(body);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Erreur réseau');
    }
    setValidating(false);
  };

  const stepLines = logs.filter((l) => l.type === 'step' || l.type === 'success' || l.type === 'error');
  const canLaunch = !!niche.trim() && !!storeName.trim() && !running;
  const formDisabled = running || !!result;

  // Apply a shortlist payload from the research copilot — fires
  // create-store directly. Plain function (no useCallback) so it always
  // captures the freshest `launch` closure; the cost of an extra child
  // render is negligible compared to the bug of a stale closure that
  // silently no-ops.
  const applyShortlist = (payload: ShortlistPayload) => {
    setValidation(null);
    setValidationError(null);
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
    // eslint-disable-next-line no-console
    console.info('[applyShortlist] launching create-store', { niche, storeName, mode: effMode });
    launch({ niche, storeName, mode: effMode }).catch((e) => {
      console.error('[applyShortlist] launch failed', e);
      setError(e instanceof Error ? e.message : 'Erreur de lancement');
    });
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Link href="/admin/stores" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
          ← Tous les stores
        </Link>
        <div className="mt-2">
          <PageHeader
            kicker="Production · Agent IA"
            title={
              <>
                Nouveau <em className="italic text-zinc-500">store</em>.
              </>
            }
            lede="L’agent compose un store complet en une passe. Il choisit les fournisseurs (AliExpress, CJ ou Claude), écrit les fiches, génère les visuels puis publie le storefront."
          />
        </div>
      </div>

      {/* ===== COPILOTE (recherche de niche pré-création) ===== */}
      {!result && (
        <NicheResearchCopilot onApplyShortlist={applyShortlist} />
      )}

      {/* Form anchor — the copilot scrolls here when "Lancer cette niche" is clicked. */}
      <div id="store-creation-form" className="max-w-3xl space-y-8 scroll-mt-8">

      {/* Manual fieldsets — collapsed by default. The copilote card
          decides mode + name + niche + template + media plan and
          launches in one click; the form stays as a fallback for the
          rare case where the operator wants to override before launch. */}
      <details className="group" open={running || !!error}>
        <summary className="cursor-pointer list-none flex items-center justify-between text-xs uppercase tracking-label text-zinc-400 hover:text-zinc-700 transition-colors py-2 select-none">
          <span>Réglages manuels (avancé)</span>
          <span className="text-zinc-300 group-open:rotate-90 transition-transform">▸</span>
        </summary>
      <div className="space-y-8 mt-4">

      {/* ===== STEP 1 — FORMAT ===== */}
      <fieldset disabled={formDisabled} className="border border-zinc-200 bg-white rounded-xl p-6">
        <FieldLabel number="01" title="Format du store" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeCard
            selected={mode === 'mono'}
            title="Mono-produit"
            lede="Un seul SKU, landing DTC longue, hero et visuels lifestyle générés sur GPU."
            onClick={() => setMode('mono')}
          />
          <ModeCard
            selected={mode === 'collection'}
            title="Collection"
            lede="Catalogue de 3 à 25 produits, sans génération d’assets."
            onClick={() => setMode('collection')}
          />
        </div>
      </fieldset>

      {/* ===== STEP 2 — IDENTITÉ ===== */}
      <fieldset disabled={formDisabled} className="border border-zinc-200 bg-white rounded-xl p-6 space-y-6">
        <div>
          <FieldLabel number="02" title="Niche" hint="presets ou texte libre" />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {NICHE_PRESETS.map((p) => {
              const active = niche === p.value;
              const Icon = p.Icon;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setNiche(p.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} aria-hidden />
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="ex. wireless earbuds, scandinavian lamp, eco bottles…"
              className="flex-1 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
            />
            <button
              type="button"
              onClick={validateNiche}
              disabled={!niche.trim() || validating}
              className="shrink-0 border border-zinc-200 text-zinc-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Estimer la saturation Meta Ads de cette niche"
            >
              {validating ? (
                <span className="inline-flex items-center gap-2"><Spinner /> Analyse…</span>
              ) : (
                'Valider la niche'
              )}
            </button>
          </div>
          {validationError && (
            <p className="mt-2 text-xs text-red-600">{validationError}</p>
          )}
          {validation && <NicheValidationPanel result={validation} />}
        </div>

        <div>
          <FieldLabel number="03" title="Nom du store" />
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="ex. ZenShop, Brisa, PhoneWorld Pro"
            className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
          />
        </div>
      </fieldset>

      {/* ===== STEP 3 — OPTIONS ===== */}
      <fieldset disabled={formDisabled} className="border border-zinc-200 bg-white rounded-xl p-6">
        <FieldLabel number="04" title="Options" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mode === 'collection' ? (
            <label className="block">
              <span className="block text-xs uppercase tracking-cta text-zinc-500 font-medium mb-1.5">
                Produits (3 à 25)
              </span>
              <input
                type="number"
                value={maxProducts}
                onChange={(e) => setMaxProducts(Number(e.target.value))}
                min={3}
                max={25}
                className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
              />
            </label>
          ) : (
            <label className="flex items-center gap-3 border border-zinc-200 rounded-lg px-3.5 py-2.5 cursor-pointer hover:border-zinc-400 transition-colors">
              <input
                type="checkbox"
                checked={!skipVideo}
                onChange={(e) => setSkipVideo(!e.target.checked)}
                className="accent-zinc-900 w-4 h-4"
              />
              <span className="text-sm text-zinc-700">Générer la vidéo promo (5 secondes)</span>
            </label>
          )}

          <label className="block">
            <span className="block text-xs uppercase tracking-cta text-zinc-500 font-medium mb-1.5">
              Langue
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
              className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors bg-white"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </fieldset>
      </div>
      </details>

      {/* ===== CTA ===== */}
      {!result && (
        <button
          onClick={() => launch()}
          disabled={!canLaunch}
          className="w-full bg-zinc-900 text-white py-3.5 rounded-lg font-medium text-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-cta"
        >
          {running ? (
            <span className="inline-flex items-center justify-center gap-3">
              <Spinner />
              Agent en cours… {elapsed}s
            </span>
          ) : (
            'Lancer l’agent'
          )}
        </button>
      )}

      {/* ===== RUNNING / DONE FEED ===== */}
      {(running || logs.length > 0) && (
        <RunStatus
          progress={progress}
          elapsed={elapsed}
          running={running}
          stepLines={stepLines}
          allLogs={logs}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails((v) => !v)}
          detailsEndRef={detailsEndRef}
        />
      )}

      {/* ===== SUCCESS ===== */}
      {result && (
        <section className="border border-zinc-200 bg-white rounded-xl p-8 text-center space-y-6">
          <p className="text-kicker uppercase tracking-label text-emerald-600 font-medium">
            Store en ligne
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
            <em className="italic">{result.storeName}</em> est prêt.
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            {result.productCount} produit{result.productCount > 1 ? 's' : ''} publié{result.productCount > 1 ? 's' : ''}.
            Le storefront accepte les commandes en{' '}
            <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">/shop/{result.slug}</code>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={`/shop/${result.slug}`}
              target="_blank"
              rel="noreferrer"
              className="bg-zinc-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-cta"
            >
              Ouvrir le store <span aria-hidden>↗</span>
            </Link>
            <Link
              href="/admin/stores"
              className="border border-zinc-200 text-zinc-700 px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              Tous les stores
            </Link>
            <button
              type="button"
              onClick={reset}
              className="border border-zinc-200 text-zinc-700 px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
            >
              Créer un autre
            </button>
          </div>
        </section>
      )}

      {/* ===== ERROR (no result) ===== */}
      {error && !result && (
        <div className="border border-red-200 bg-red-50/60 rounded-xl p-5">
          <p className="text-kicker uppercase tracking-label text-red-700 font-medium">Échec de l’agent</p>
          <p className="mt-1.5 text-sm text-red-900 leading-relaxed">{error}</p>
        </div>
      )}
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  title,
  lede,
  onClick,
}: {
  selected: boolean;
  title: string;
  lede: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-5 rounded-lg border text-left transition-all ${
        selected
          ? 'border-zinc-900 bg-zinc-900 text-white'
          : 'border-zinc-200 hover:border-zinc-400 bg-white text-zinc-700'
      }`}
    >
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className={`text-xs leading-relaxed ${selected ? 'text-white/70' : 'text-zinc-500'}`}>{lede}</div>
      {selected && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white" aria-hidden />
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function RunStatus({
  progress,
  elapsed,
  running,
  stepLines,
  allLogs,
  showDetails,
  onToggleDetails,
  detailsEndRef,
}: {
  progress: number;
  elapsed: number;
  running: boolean;
  stepLines: LogLine[];
  allLogs: LogLine[];
  showDetails: boolean;
  onToggleDetails: () => void;
  detailsEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const lastIndex = stepLines.length - 1;

  return (
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200/70 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            {running ? 'Agent en cours' : progress === 100 ? 'Terminé' : 'En pause'}
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            {stepLines[lastIndex]?.message ?? 'Initialisation…'}
          </p>
        </div>
        <div className="text-right shrink-0 tabular-nums">
          <div className="font-semibold tracking-tight text-2xl text-zinc-900">{progress}%</div>
          <div className="text-kicker text-zinc-400">{elapsed}s écoulées</div>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="px-6 py-5 space-y-3">
        {stepLines.map((line, idx) => {
          const isLast = idx === lastIndex;
          const isError = line.type === 'error';
          const isSuccess = line.type === 'success';
          const isActive = running && isLast && !isError && !isSuccess;
          const dotClass = isError
            ? 'bg-red-500'
            : isSuccess
            ? 'bg-emerald-500'
            : isActive
            ? 'bg-zinc-900 admin-step-pulse'
            : 'bg-zinc-300';
          const textClass = isError
            ? 'text-red-700'
            : isSuccess
            ? 'text-emerald-700 font-medium'
            : isActive
            ? 'text-zinc-900 font-medium'
            : 'text-zinc-500';
          return (
            <li key={line.id} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}
                aria-hidden
              />
              <span className={`leading-relaxed ${textClass}`}>{line.message}</span>
              <span className="ml-auto text-kicker text-zinc-300 font-mono shrink-0 tabular-nums">
                {line.ts}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-zinc-200/70 px-6 py-3">
        <button
          type="button"
          onClick={onToggleDetails}
          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1.5"
        >
          <span aria-hidden>{showDetails ? '▾' : '▸'}</span>
          Détails techniques ({allLogs.length})
        </button>
        {showDetails && (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 font-mono text-[11px] leading-relaxed space-y-0.5">
            {allLogs.map((log) => (
              <div key={log.id} className="flex gap-2 text-zinc-600">
                <span className="text-zinc-400 shrink-0 w-16 tabular-nums">{log.ts}</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
            <div ref={detailsEndRef} />
          </div>
        )}
      </div>
    </section>
  );
}

function NicheValidationPanel({ result }: { result: NicheValidationResult }) {
  const verdictTone: Tone =
    result.verdict === 'no-go' ? 'red' : result.verdict === 'caution' ? 'amber' : 'emerald';
  const verdictLabel =
    result.verdict === 'no-go'
      ? 'Marché saturé'
      : result.verdict === 'caution'
      ? 'Concurrence soutenue'
      : 'Marché ouvert';
  const sourceLabel =
    result.source === 'meta-html'
      ? 'Meta Ads Library'
      : result.source === 'cache'
      ? 'Cache 24h'
      : 'Estimation Claude (fallback)';

  // The gauge is a simple linear bar coloured by verdict — saturation
  // is bounded 0-100 so width = saturation%.
  const gaugeColor =
    result.verdict === 'no-go'
      ? 'bg-red-500'
      : result.verdict === 'caution'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="mt-4 border border-zinc-200 bg-white rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200/70 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            Validation niche · {sourceLabel}
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">
            <em className="italic">{verdictLabel}</em>
          </h3>
        </div>
        <StatusPill tone={verdictTone}>{result.verdict.toUpperCase()}</StatusPill>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard
          label="Saturation"
          value={`${result.saturation}/100`}
          hint={
            <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${gaugeColor}`}
                style={{ width: `${result.saturation}%` }}
              />
            </div>
          }
          tone={verdictTone}
        />
        <StatCard
          label="Ads actives estimées"
          value={result.totalAds.toLocaleString('fr-FR')}
          hint={`${result.topAdvertisers.length} annonceur${result.topAdvertisers.length > 1 ? 's' : ''} top`}
        />
      </div>

      {result.topAdvertisers.length > 0 && (
        <div className="px-5 py-4 border-t border-zinc-200/70">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium mb-2">
            Top annonceurs
          </p>
          <ul className="space-y-1.5">
            {result.topAdvertisers.map((a) => (
              <li
                key={`${a.name}-${a.pageId ?? ''}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-zinc-700 truncate">{a.name}</span>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0 ml-3">
                  {a.adCount} ad{a.adCount > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.sampleCreatives.length > 0 && (
        <div className="px-5 py-4 border-t border-zinc-200/70">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium mb-2">
            Créas observées ({result.sampleCreatives.length})
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.sampleCreatives.map((c, idx) => (
              <li
                key={c.adId ?? `${c.advertiser}-${idx}`}
                className="flex items-center gap-3 border border-zinc-200 rounded-lg p-2"
              >
                {c.previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.previewImage}
                    alt=""
                    className="w-12 h-12 rounded object-cover bg-zinc-100 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-zinc-100 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-zinc-700 truncate">{c.advertiser}</p>
                  {c.landingUrl ? (
                    <a
                      href={c.landingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs text-zinc-400 hover:text-zinc-900 truncate block"
                    >
                      {new URL(c.landingUrl).hostname}
                    </a>
                  ) : c.startedAt ? (
                    <p className="text-xs text-zinc-400">depuis {c.startedAt}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.angles.length > 0 && (
        <div className="px-5 py-4 border-t border-zinc-200/70">
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium mb-2">
            Angles éditoriaux récurrents
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.angles.map((angle) => (
              <span
                key={angle}
                className="inline-flex items-center px-2.5 py-1 rounded-full border border-zinc-200 text-xs text-zinc-700"
              >
                {angle}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.verdict === 'no-go' && (
        <div className="px-5 py-3 bg-red-50/60 border-t border-red-200 text-xs text-red-800 leading-relaxed">
          Niche très saturée sur Meta Ads. La création de store n’est pas bloquée — mais prévoyez un budget acquisition supérieur ou un angle différenciant fort.
        </div>
      )}
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
