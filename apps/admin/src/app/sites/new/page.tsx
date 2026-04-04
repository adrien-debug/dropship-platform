'use client';

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Design Systems (hardcoded)
// ---------------------------------------------------------------------------

const DESIGN_SYSTEMS = [
  {
    id: 'ds-minimal',
    name: 'Minimal White',
    description: 'Epure, typographie forte, fond blanc. Ideal pour le luxe accessible.',
    colors: ['#ffffff', '#1a1a1a', '#f5f5f5', '#e0e0e0', '#c0a060'],
    audience: ['Luxe', 'Mode', 'Beaute'],
    niches: ['cosmetique', 'mode', 'bijoux', 'beaute', 'luxe'],
  },
  {
    id: 'ds-dark-edge',
    name: 'Dark Edge',
    description: 'Sombre et audacieux avec accents neon. Parfait pour le gaming et la tech.',
    colors: ['#0d0d0d', '#1a1a2e', '#e94560', '#00f5d4', '#f8f8f8'],
    audience: ['Gaming', 'Tech', 'Geek'],
    niches: ['figurines', 'gaming', 'tech', 'anime', 'manga', 'geek'],
  },
  {
    id: 'ds-nature',
    name: 'Nature Zen',
    description: 'Tons naturels et apaisants. Pour le bio, bien-etre et eco-responsable.',
    colors: ['#f4f1ea', '#2d5a27', '#8fbc8f', '#deb887', '#5a3e2b'],
    audience: ['Bio', 'Bien-etre', 'Eco'],
    niches: ['bio', 'naturel', 'bien-etre', 'ecologique', 'plante', 'herbe'],
  },
  {
    id: 'ds-pop-color',
    name: 'Pop Color',
    description: 'Couleurs vives et energiques. Ideal pour les produits fun et jeunes.',
    colors: ['#fef3c7', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    audience: ['Jeune', 'Fun', 'Tendance'],
    niches: ['jouet', 'gadget', 'accessoire', 'fun', 'cadeau'],
  },
  {
    id: 'ds-ocean',
    name: 'Ocean Breeze',
    description: 'Bleus profonds et blancs frais. Pour la nautique et les sports outdoor.',
    colors: ['#f0f9ff', '#0369a1', '#0ea5e9', '#e0f2fe', '#1e3a5f'],
    audience: ['Sport', 'Outdoor', 'Nautique'],
    niches: ['sport', 'outdoor', 'nautique', 'plage', 'surf'],
  },
  {
    id: 'ds-retro',
    name: 'Retro Vibes',
    description: 'Palette vintage, typo retro. Pour les produits nostalgiques et collectors.',
    colors: ['#fdf6e3', '#cb4b16', '#268bd2', '#d33682', '#2aa198'],
    audience: ['Vintage', 'Collector', 'Retro'],
    niches: ['vintage', 'retro', 'collector', 'vinyle', 'ancien'],
  },
  {
    id: 'ds-pastel',
    name: 'Pastel Dream',
    description: 'Pastels doux et arrondis. Parfait pour bebe, enfant et lifestyle.',
    colors: ['#fff5f5', '#fbb6ce', '#b794f4', '#90cdf4', '#9ae6b4'],
    audience: ['Bebe', 'Enfant', 'Lifestyle'],
    niches: ['bebe', 'enfant', 'maternite', 'lifestyle', 'deco'],
  },
  {
    id: 'ds-industrial',
    name: 'Industrial Raw',
    description: 'Brut et masculin. Beton, metal, typo sans-serif epaisse.',
    colors: ['#1f1f1f', '#4a4a4a', '#8b8b8b', '#d4d4d4', '#ff6b35'],
    audience: ['Homme', 'Bricolage', 'Auto'],
    niches: ['outil', 'bricolage', 'auto', 'moto', 'homme'],
  },
  {
    id: 'ds-sakura',
    name: 'Sakura',
    description: 'Inspire du Japon. Rose cerisier, noir encre, touches dorees.',
    colors: ['#fff5f7', '#1a1a2e', '#f687b3', '#fbd38d', '#e53e3e'],
    audience: ['Anime', 'Japon', 'Culture'],
    niches: ['anime', 'manga', 'japon', 'figurines', 'cosplay'],
  },
  {
    id: 'ds-premium',
    name: 'Premium Gold',
    description: 'Noir et or. Elegance absolue pour le haut de gamme.',
    colors: ['#0a0a0a', '#1a1a1a', '#d4af37', '#f5e6c8', '#ffffff'],
    audience: ['Premium', 'Luxe', 'VIP'],
    niches: ['premium', 'luxe', 'montre', 'bijoux', 'accessoire'],
  },
];

const MARKETS = ['France', 'Europe', 'US', 'Monde'] as const;
const POSITIONINGS = ['Budget', 'Milieu de gamme', 'Premium'] as const;

const DEPLOY_STEPS = [
  'Creation du Sales Channel Medusa...',
  'Import des produits...',
  'Configuration Supabase...',
  'Build du storefront...',
  'Deploiement GPU2...',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
          products: data.selectedProducts.map(p => p.id),
          designSystem: data.designSystemId,
          name: data.shopName,
          slug: data.slug,
          port: data.port,
          darkMode: data.darkMode,
        }),
      });
      const json = await res.json();
      setDeployedUrl(json.url ?? `http://100.110.74.114:${data.port}`);
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/sites" className="text-gray-400 transition hover:text-gray-700">
          ← Sites
        </a>
        <h2 className="text-2xl font-bold">Nouvelle boutique</h2>
      </div>

      {/* Progress */}
      <ProgressBar step={step} />

      {/* Steps */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        {step === 0 && <StepNiche data={data} setData={setData} />}
        {step === 1 && <StepDesign data={data} setData={setData} />}
        {step === 2 && <StepConfig data={data} setData={setData} />}
        {step === 3 && <StepSummary data={data} />}
        {step === 4 && (
          <StepDeploy statuses={deployStatus} deployedUrl={deployedUrl} onReset={reset} />
        )}
      </div>

      {/* Navigation */}
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
          <span
            className={`text-xs ${i <= step ? 'font-medium text-brand' : 'text-gray-400'}`}
          >
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

      {/* Niche input */}
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

      {/* Market */}
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

      {/* Positioning */}
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

      {/* Results */}
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
// Step 2 — Design System
// ---------------------------------------------------------------------------

function StepDesign({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const nicheLC = data.niche.toLowerCase();
  const recommended = DESIGN_SYSTEMS.find(ds =>
    ds.niches.some(n => nicheLC.includes(n)),
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Design System</h3>
      <p className="text-sm text-gray-500">
        Choisissez le theme visuel de votre boutique.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {DESIGN_SYSTEMS.map(ds => {
          const isRec = recommended?.id === ds.id;
          const isSelected = data.designSystemId === ds.id;
          return (
            <button
              key={ds.id}
              onClick={() => setData(prev => ({ ...prev, designSystemId: ds.id }))}
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

              {/* Color preview */}
              <div className="mb-3 flex gap-1.5">
                {ds.colors.map((c, i) => (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-full border border-gray-200"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <p className="font-semibold">{ds.name}</p>
              <p className="mt-1 text-xs text-gray-500">{ds.description}</p>

              {/* Audience tags */}
              <div className="mt-2 flex flex-wrap gap-1">
                {ds.audience.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
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

      {/* Domain preview */}
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
  const ds = DESIGN_SYSTEMS.find(d => d.id === data.designSystemId);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Resume</h3>
      <p className="text-sm text-gray-500">
        Verifiez les informations avant de lancer la creation.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Niche */}
        <SummaryCard label="Niche" value={data.niche} />
        <SummaryCard label="Marche cible" value={data.market} />
        <SummaryCard label="Positionnement" value={data.positioning} />
        <SummaryCard
          label="Produits selectionnes"
          value={`${data.selectedProducts.length} produit${data.selectedProducts.length > 1 ? 's' : ''}`}
        />

        {/* Design system */}
        <div className="rounded-lg border p-4 sm:col-span-2">
          <p className="text-xs font-medium text-gray-500">Design System</p>
          <div className="mt-1 flex items-center gap-3">
            {ds && (
              <>
                <div className="flex gap-1">
                  {ds.colors.map((c, i) => (
                    <div
                      key={i}
                      className="h-5 w-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="font-medium">{ds.name}</span>
              </>
            )}
          </div>
        </div>

        <SummaryCard label="Nom" value={data.shopName} />
        <SummaryCard label="Slug" value={data.slug} />
        <SummaryCard label="Port" value={String(data.port)} />
        <SummaryCard label="Dark mode" value={data.darkMode ? 'Oui' : 'Non'} />
      </div>

      {/* Deployment estimate */}
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

      {/* Deployed */}
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
