'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '../../../_components/AdminUI';

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

const NICHE_PRESETS = [
  { label: '🏠 Home decor', value: 'home decor' },
  { label: '📱 Phone accessories', value: 'phone accessories' },
  { label: '🧘 Yoga & bien-être', value: 'yoga wellness' },
  { label: '🐾 Animaux', value: 'pet accessories' },
  { label: '💄 Beauté', value: 'beauty skincare' },
  { label: '🏋️ Fitness', value: 'fitness equipment' },
  { label: '👶 Bébé', value: 'baby products' },
  { label: '🎮 Gaming', value: 'gaming accessories' },
  { label: '🌿 Jardinage', value: 'garden outdoor' },
  { label: '✈️ Voyage', value: 'travel accessories' },
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

  const launch = async () => {
    if (!niche.trim() || !storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);
    setElapsed(0);
    startTimeRef.current = Date.now();

    try {
      const res = await fetch('/api/agent/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, storeName, mode, maxProducts, language, skipVideo }),
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
  };

  const stepLines = logs.filter((l) => l.type === 'step' || l.type === 'success' || l.type === 'error');
  const canLaunch = !!niche.trim() && !!storeName.trim() && !running;
  const formDisabled = running || !!result;

  return (
    <div className="max-w-3xl space-y-8">
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
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setNiche(p.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="ex. wireless earbuds, scandinavian lamp, eco bottles…"
            className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
          />
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

      {/* ===== CTA ===== */}
      {!result && (
        <button
          onClick={launch}
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
          <h2 className="text-3xl font-serif text-zinc-900">
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
          <div className="font-serif text-2xl text-zinc-900">{progress}%</div>
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

export default function NewStorePage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Chargement…</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
