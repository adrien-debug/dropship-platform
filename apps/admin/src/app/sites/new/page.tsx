'use client';

import { useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DSEntry {
  id: string;
  num: string;
  name: string;
  category: string;
  description: string;
  audience: string[];
  darkMode: boolean;
  accentColor: string;
  bgColor: string;
  textColor: string;
}

interface TrendingProduct {
  id: string;
  title: string;
  price: number;
  image?: string;
  source?: string;
}

interface WizardData {
  niche: string;
  market: (typeof MARKETS)[number];
  positioning: (typeof POSITIONINGS)[number];
  selectedProducts: TrendingProduct[];
  designSystemId: string;
  shopName: string;
  slug: string;
  port: number;
  darkMode: boolean;
}

const MARKETS = ['France', 'Europe', 'US', 'Monde'] as const;
const POSITIONINGS = ['Budget', 'Milieu de gamme', 'Premium'] as const;

const DEPLOY_STEPS = [
  'Creation du Sales Channel Medusa...',
  'Import des produits...',
  'Configuration design system...',
  'Build du storefront...',
  'Deploiement GPU2...',
];

// ---------------------------------------------------------------------------
// Wizard Page
// ---------------------------------------------------------------------------

export default function NewSiteWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    niche: '',
    market: 'France',
    positioning: 'Milieu de gamme',
    selectedProducts: [],
    designSystemId: '',
    shopName: '',
    slug: '',
    port: 3102,
    darkMode: false,
  });

  const [deployStatus, setDeployStatus] = useState<('pending' | 'running' | 'done')[]>(
    DEPLOY_STEPS.map(() => 'pending'),
  );
  const [deployedUrl, setDeployedUrl] = useState('');

  const canNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        return data.niche.trim().length > 0 && data.selectedProducts.length > 0;
      case 1:
        return data.designSystemId !== '';
      case 2:
        return data.shopName.trim().length > 0 && data.slug.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, data]);

  const startDeploy = async () => {
    setStep(4);
    const statuses: ('pending' | 'running' | 'done')[] = DEPLOY_STEPS.map(() => 'pending');

    for (let i = 0; i < DEPLOY_STEPS.length; i++) {
      statuses[i] = 'running';
      setDeployStatus([...statuses]);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      statuses[i] = 'done';
      setDeployStatus([...statuses]);
    }

    try {
      const res = await fetch('/api/shops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: data.niche,
          market: data.market,
          positioning: data.positioning,
          products: data.selectedProducts.map(p => ({
            title: p.title,
            price: p.price,
            image: p.image,
            supplier: p.source,
          })),
          designSystem: data.designSystemId,
          name: data.shopName,
          slug: data.slug,
          port: data.port,
          darkMode: data.darkMode,
        }),
      });
      const json = await res.json();
      setDeployedUrl(json.shop?.url ?? `http://100.110.74.114:${data.port}`);
    } catch {
      setDeployedUrl(`http://100.110.74.114:${data.port}`);
    }
  };

  const reset = () => {
    setStep(0);
    setData({
      niche: '',
      market: 'France',
      positioning: 'Milieu de gamme',
      selectedProducts: [],
      designSystemId: '',
      shopName: '',
      slug: '',
      port: 3102,
      darkMode: false,
    });
    setDeployStatus(DEPLOY_STEPS.map(() => 'pending'));
    setDeployedUrl('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/sites" className="text-gray-400 transition hover:text-gray-700">
          ← Sites
        </a>
        <h2 className="text-2xl font-bold">Nouvelle boutique</h2>
      </div>

      <ProgressBar step={step} />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        {step === 0 && <StepNiche data={data} setData={setData} />}
        {step === 1 && <StepDesign data={data} setData={setData} />}
        {step === 2 && <StepConfig data={data} setData={setData} />}
        {step === 3 && <StepSummary data={data} />}
        {step === 4 && (
          <StepDeploy statuses={deployStatus} deployedUrl={deployedUrl} onReset={reset} />
        )}
      </div>

      {step < 4 && (
        <div className="flex justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-30"
          >
            Precedent
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-40"
            >
              Suivant
            </button>
          ) : (
            <button
              onClick={startDeploy}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Creer la boutique
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Niche & Produits', 'Design', 'Configuration', 'Resume', 'Deploiement'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full transition-colors ${
              i <= step ? 'bg-brand' : 'bg-gray-200'
            }`}
          />
          <span className={`text-xs ${i <= step ? 'font-medium text-brand' : 'text-gray-400'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Niche & Products
// ---------------------------------------------------------------------------

function StepNiche({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const [searchResults, setSearchResults] = useState<TrendingProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!data.niche.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/trending?q=${encodeURIComponent(data.niche)}`);
      const json = await res.json();
      setSearchResults(json.products ?? []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const toggleProduct = (product: TrendingProduct) => {
    setData(prev => {
      const exists = prev.selectedProducts.find(p => p.id === product.id);
      return {
        ...prev,
        selectedProducts: exists
          ? prev.selectedProducts.filter(p => p.id !== product.id)
          : [...prev.selectedProducts, product],
      };
    });
  };

  const isSelected = (id: string) => data.selectedProducts.some(p => p.id === id);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Niche & Produits</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Quel type de produits ?
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={data.niche}
            onChange={e => setData(prev => ({ ...prev, niche: e.target.value }))}
            placeholder='ex: "figurines anime", "cosmetique bio"'
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={searching || !data.niche.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-40"
          >
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Marche cible</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARKETS.map(m => (
            <button
              key={m}
              onClick={() => setData(prev => ({ ...prev, market: m }))}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                data.market === m
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Positionnement</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {POSITIONINGS.map(p => (
            <button
              key={p}
              onClick={() => setData(prev => ({ ...prev, positioning: p }))}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                data.positioning === p
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {searchResults.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Resultats ({searchResults.length})
            </p>
            {data.selectedProducts.length > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                {data.selectedProducts.length} selectionne
                {data.selectedProducts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.map(product => (
              <button
                key={product.id}
                onClick={() => toggleProduct(product)}
                className={`rounded-lg border p-3 text-left transition ${
                  isSelected(product.id)
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.title}
                    className="mb-2 h-24 w-full rounded object-cover"
                  />
                )}
                <p className="text-sm font-medium line-clamp-2">{product.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {product.price.toFixed(2)} € — {product.source ?? 'AliExpress'}
                </p>
                {isSelected(product.id) && (
                  <span className="mt-1 inline-block text-xs font-medium text-green-600">
                    ✓ Selectionne
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Recherche de produits tendance...
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Design System (dynamique via API)
// ---------------------------------------------------------------------------

function StepDesign({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const [dsList, setDsList] = useState<DSEntry[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [loadingDS, setLoadingDS] = useState(true);

  useEffect(() => {
    const url = data.niche
      ? `/api/design-systems?audience=${encodeURIComponent(data.niche)}`
      : '/api/design-systems';

    fetch(url)
      .then(r => r.json())
      .then(json => {
        setDsList(json.designSystems ?? []);
        setSuggested(json.suggested ?? []);
      })
      .catch(() => setDsList([]))
      .finally(() => setLoadingDS(false));
  }, [data.niche]);

  if (loadingDS) {
    return (
      <div className="flex items-center gap-2 py-12 text-gray-500">
        <Spinner /> Chargement des design systems...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Design System</h3>
      <p className="text-sm text-gray-500">
        Choisissez le theme visuel de votre boutique. {dsList.length} disponible{dsList.length > 1 ? 's' : ''}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {dsList.map(ds => {
          const isRec = suggested.includes(ds.id);
          const isSelected = data.designSystemId === ds.id;
          return (
            <button
              key={ds.id}
              onClick={() =>
                setData(prev => ({ ...prev, designSystemId: ds.id, darkMode: ds.darkMode }))
              }
              className={`relative rounded-xl border p-4 text-left transition ${
                isSelected
                  ? 'border-brand ring-2 ring-brand'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {isRec && (
                <span className="absolute -top-2 right-3 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Recommande
                </span>
              )}

              <div className="mb-3 flex items-center gap-2">
                <div
                  className="h-10 w-10 rounded-lg border"
                  style={{ backgroundColor: ds.bgColor, borderColor: ds.accentColor }}
                />
                <div
                  className="h-10 w-10 rounded-lg"
                  style={{ backgroundColor: ds.accentColor }}
                />
                <span className="ml-1 text-xs font-mono text-gray-400">{ds.num}</span>
              </div>

              <p className="font-semibold">{ds.name}</p>
              <p className="mt-1 text-xs text-gray-500">{ds.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {ds.category}
                </span>
                {ds.audience.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
                {ds.darkMode && (
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-white">
                    dark
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Configuration
// ---------------------------------------------------------------------------

function StepConfig({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const slugify = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleNameChange = (name: string) => {
    setData(prev => ({
      ...prev,
      shopName: name,
      slug: slugify(name),
    }));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Configuration</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nom de la boutique</label>
          <input
            type="text"
            value={data.shopName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ma Boutique Anime"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Slug</label>
          <input
            type="text"
            value={data.slug}
            onChange={e => setData(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="ma-boutique-anime"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Port</label>
          <input
            type="number"
            value={data.port}
            onChange={e => setData(prev => ({ ...prev, port: Number(e.target.value) }))}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-1 text-xs text-gray-400">Port par defaut : 3102</p>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={() => setData(prev => ({ ...prev, darkMode: !prev.darkMode }))}
            className={`relative h-6 w-11 rounded-full transition ${
              data.darkMode ? 'bg-brand' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                data.darkMode ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">Dark mode par defaut</span>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-xs font-medium text-gray-500">Apercu du domaine</p>
        <p className="mt-1 font-mono text-sm text-brand">
          http://100.110.74.114:{data.port}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Summary
// ---------------------------------------------------------------------------

function StepSummary({ data }: { data: WizardData }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Resume</h3>
      <p className="text-sm text-gray-500">
        Verifiez les informations avant de lancer la creation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Niche" value={data.niche} />
        <SummaryCard label="Marche cible" value={data.market} />
        <SummaryCard label="Positionnement" value={data.positioning} />
        <SummaryCard
          label="Produits selectionnes"
          value={`${data.selectedProducts.length} produit${data.selectedProducts.length > 1 ? 's' : ''}`}
        />
        <SummaryCard label="Design System" value={data.designSystemId} />
        <SummaryCard label="Nom" value={data.shopName} />
        <SummaryCard label="Slug" value={data.slug} />
        <SummaryCard label="Port" value={String(data.port)} />
        <SummaryCard label="Dark mode" value={data.darkMode ? 'Oui' : 'Non'} />
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        <span>⏱</span>
        Temps de deploiement estime : ~30 secondes
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Deployment
// ---------------------------------------------------------------------------

function StepDeploy({
  statuses,
  deployedUrl,
  onReset,
}: {
  statuses: ('pending' | 'running' | 'done')[];
  deployedUrl: string;
  onReset: () => void;
}) {
  const allDone = statuses.every(s => s === 'done');

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Deploiement</h3>

      <div className="space-y-3">
        {DEPLOY_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            {statuses[i] === 'pending' && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
                {i + 1}
              </span>
            )}
            {statuses[i] === 'running' && <Spinner />}
            {statuses[i] === 'done' && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-600">
                ✓
              </span>
            )}
            <span
              className={`text-sm ${
                statuses[i] === 'pending'
                  ? 'text-gray-400'
                  : statuses[i] === 'running'
                    ? 'font-medium text-brand'
                    : 'text-gray-700'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {allDone && deployedUrl && (
        <div className="space-y-4 rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-green-700">Boutique deployee !</p>
          <a
            href={deployedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-sm text-brand underline"
          >
            {deployedUrl}
          </a>
          <div>
            <button
              onClick={onReset}
              className="mt-2 rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white"
            >
              Creer une autre boutique
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
  );
}
