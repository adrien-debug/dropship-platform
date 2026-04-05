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

interface WizardData {
  niche: string;
  market: (typeof MARKETS)[number];
  positioning: (typeof POSITIONINGS)[number];
  designSystemId: string;
  shopName: string;
  slug: string;
  port: number;
  darkMode: boolean;
  // Advanced options
  brandColors?: {
    accent?: string;
    bg?: string;
    text?: string;
  };
  referenceUrls?: string[];
  tagline?: string;
  tone?: 'friendly' | 'professional' | 'sophisticated' | 'playful' | 'bold';
  pages?: string[]; // Liste des pages à générer
  productCount?: number; // Nombre de produits à sourcer
}

const MARKETS = ['France', 'Europe', 'US', 'Monde'] as const;
const POSITIONINGS = ['Budget', 'Milieu de gamme', 'Premium'] as const;

const DEPLOY_STEPS = [
  { id: 'medusa', label: 'Creation Sales Channel Medusa + cle API' },
  { id: 'scaffold', label: 'Scaffold du projet Next.js' },
  { id: 'codegen', label: 'Generation du code par IA (Qwen)' },
  { id: 'integrations', label: 'Integration Medusa, Stripe, Supabase' },
  { id: 'assets', label: 'Generation logo & hero image' },
  { id: 'install', label: 'Installation des dependances' },
  { id: 'build', label: 'Build du storefront' },
  { id: 'deploy', label: 'Deploiement sur GPU2' },
];

// ---------------------------------------------------------------------------
// Wizard Page
// ---------------------------------------------------------------------------

export default function NewSiteWizard() {
  const [step, setStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [data, setData] = useState<WizardData>({
    niche: '',
    market: 'France',
    positioning: 'Milieu de gamme',
    designSystemId: '',
    shopName: '',
    slug: '',
    port: 3102,
    darkMode: false,
    brandColors: {},
    referenceUrls: [],
    tagline: '',
    tone: 'professional',
    pages: ['home', 'shop', 'about', 'contact'],
    productCount: 12,
  });

  const [deployStatus, setDeployStatus] = useState<Record<string, 'pending' | 'running' | 'done' | 'error'>>(
    Object.fromEntries(DEPLOY_STEPS.map(s => [s.id, 'pending'])),
  );
  const [deployedUrl, setDeployedUrl] = useState('');
  const [deployError, setDeployError] = useState('');
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  const canNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        return data.niche.trim().length > 0;
      case 1:
        return data.designSystemId !== '';
      case 2:
        return data.shopName.trim().length > 0 && data.slug.trim().length > 0;
      case 3:
        return true; // Advanced step is optional
      case 4:
        return true; // Summary
      default:
        return false;
    }
  }, [step, data]);

  const startDeploy = async () => {
    setStep(4);
    setDeployError('');
    setDeployLogs([]);
    const statuses: Record<string, 'pending' | 'running' | 'done' | 'error'> =
      Object.fromEntries(DEPLOY_STEPS.map(s => [s.id, 'pending' as const]));
    const updateStep = (id: string, status: 'running' | 'done' | 'error') => {
      statuses[id] = status;
      setDeployStatus({ ...statuses });
    };
    const addLog = (msg: string) => setDeployLogs(prev => [...prev, msg]);

    try {
      // Step 1: Medusa setup (sales channel + pub key + Supabase record)
      updateStep('medusa', 'running');
      addLog('Creation du Sales Channel Medusa...');
      const medusaRes = await fetch('/api/shops/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.shopName,
          slug: data.slug,
          port: data.port,
          niche: data.niche,
          market: data.market,
          positioning: data.positioning,
          designSystem: data.designSystemId,
          productCount: data.productCount || 12,
        }),
      });
      const medusaJson = await medusaRes.json();
      if (!medusaRes.ok) throw new Error(medusaJson.error || 'Medusa setup failed');
      updateStep('medusa', 'done');
      addLog(`Sales Channel: ${medusaJson.salesChannelId}`);
      addLog(`Site ID: ${medusaJson.siteId}`);
      addLog(`Imported products: ${medusaJson.importedProducts?.length ?? 0}`);

      // Step 2+: Launcher SSE pipeline
      const launcherRes = await fetch('/api/launcher/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            projectName: data.shopName,
            niche: data.niche,
            outputDir: `~/sites/${data.slug}`,
            designSystem: data.designSystemId,
            port: data.port,
            market: data.market,
            positioning: data.positioning,
            siteId: medusaJson.siteId,
            salesChannelId: medusaJson.salesChannelId,
            publishableKey: medusaJson.publishableKey,
            regionId: medusaJson.regionId,
            importedProducts: medusaJson.importedProducts ?? [],
            // Advanced options
            tagline: data.tagline,
            tone: data.tone || 'professional',
            brandColors: data.brandColors,
            referenceUrls: data.referenceUrls || [],
            pages: data.pages || ['home', 'shop', 'about', 'contact'],
          },
        }),
      });

      if (!launcherRes.body) throw new Error('No stream body');
      const reader = launcherRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const stepMap: Record<string, string> = {
        scaffold: 'scaffold',
        codegen: 'codegen',
        integrations: 'integrations',
        assets: 'assets',
        install: 'install',
        deploy: 'deploy',
        pipeline: 'deploy',
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            const uiStep = stepMap[evt.step] || evt.step;

            if (evt.status === 'running' && statuses[uiStep] === 'pending') {
              updateStep(uiStep, 'running');
            }
            if (evt.status === 'done') {
              updateStep(uiStep, 'done');
            }
            if (evt.status === 'error') {
              updateStep(uiStep, 'error');
              addLog(`Erreur: ${evt.detail}`);
            }
            addLog(`[${evt.step}] ${evt.detail}`);

            if (evt.step === 'pipeline' && evt.status === 'done') {
              DEPLOY_STEPS.forEach(s => updateStep(s.id, 'done'));
              setDeployedUrl(`http://100.110.74.114:${data.port}`);
            }
            if (evt.step === 'pipeline' && evt.status === 'error') {
              setDeployError(String(evt.detail || 'Pipeline failed'));
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeployError(msg);
      addLog(`ERREUR: ${msg}`);
    }
  };

  const reset = () => {
    setStep(0);
    setData({
      niche: '',
      market: 'France',
      positioning: 'Milieu de gamme',
      designSystemId: '',
      shopName: '',
      slug: '',
      port: 3102,
      darkMode: false,
    });
    setDeployStatus(Object.fromEntries(DEPLOY_STEPS.map(s => [s.id, 'pending'])));
    setDeployedUrl('');
    setDeployError('');
    setDeployLogs([]);
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
        {step === 3 && <StepAdvanced data={data} setData={setData} />}
        {step === 4 && <StepSummary data={data} />}
        {step === 5 && (
          <StepDeploy
            statuses={deployStatus}
            deployedUrl={deployedUrl}
            deployError={deployError}
            logs={deployLogs}
            onReset={reset}
          />
        )}
      </div>

      {step < 5 && (
        <div className="flex justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-30"
          >
            Precedent
          </button>
          {step < 4 ? (
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

const STEP_LABELS = ['Niche & Marche', 'Design', 'Configuration', 'Avance', 'Resume', 'Deploiement'];

const AVAILABLE_PAGES = [
  { id: 'home', label: 'Accueil', required: true },
  { id: 'shop', label: 'Boutique', required: true },
  { id: 'about', label: 'A propos', required: false },
  { id: 'contact', label: 'Contact', required: false },
  { id: 'blog', label: 'Blog', required: false },
  { id: 'faq', label: 'FAQ', required: false },
  { id: 'shipping', label: 'Livraison', required: false },
  { id: 'returns', label: 'Retours', required: false },
];

const TONE_OPTIONS = [
  { id: 'friendly', label: 'Amical', desc: 'Chaleureux et accessible' },
  { id: 'professional', label: 'Professionnel', desc: 'Serieux et credible' },
  { id: 'sophisticated', label: 'Sophistique', desc: 'Elegant et premium' },
  { id: 'playful', label: 'Ludique', desc: 'Fun et energique' },
  { id: 'bold', label: 'Audacieux', desc: 'Impactant et direct' },
] as const;

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

const NICHE_SUGGESTIONS = [
  'Figurines anime',
  'Cosmetique bio',
  'Tech & Gadgets',
  'Mode streetwear',
  'Bijoux minimalistes',
  'Accessoires gaming',
  'Maison & Deco',
  'Sport & Fitness',
];

function StepNiche({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Niche & Marche</h3>
      <p className="text-sm text-gray-500">
        Decrivez votre niche. Les produits seront recherches automatiquement chez les fournisseurs.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Quelle niche / type de produits ?
        </label>
        <input
          type="text"
          value={data.niche}
          onChange={e => setData(prev => ({ ...prev, niche: e.target.value }))}
          placeholder='ex: "figurines anime One Piece", "cosmetique bio coreen"'
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {NICHE_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setData(prev => ({ ...prev, niche: s }))}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                data.niche === s
                  ? 'border-brand bg-brand/10 text-brand font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
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

      <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
        <span>💡</span>
        Les produits seront automatiquement sourced via CJ Dropshipping et Medusa lors du deploiement.
      </div>
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
// Step 4 — Advanced Options
// ---------------------------------------------------------------------------

function StepAdvanced({
  data,
  setData,
}: {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const addReferenceUrl = () => {
    const url = prompt('URL du site de reference:');
    if (url) {
      setData(prev => ({ ...prev, referenceUrls: [...(prev.referenceUrls || []), url] }));
    }
  };

  const removeReferenceUrl = (idx: number) => {
    setData(prev => ({
      ...prev,
      referenceUrls: (prev.referenceUrls || []).filter((_, i) => i !== idx),
    }));
  };

  const togglePage = (pageId: string) => {
    const pages = data.pages || [];
    if (pages.includes(pageId)) {
      setData(prev => ({ ...prev, pages: pages.filter(p => p !== pageId) }));
    } else {
      setData(prev => ({ ...prev, pages: [...pages, pageId] }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Options avancees</h3>
        <span className="text-xs text-gray-400">Optionnel</span>
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tagline / Slogan
        </label>
        <input
          type="text"
          value={data.tagline || ''}
          onChange={e => setData(prev => ({ ...prev, tagline: e.target.value }))}
          placeholder="ex: La reference des figurines anime en France"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-xs text-gray-400">
          Si vide, sera genere automatiquement par l'IA
        </p>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Ton editorial</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {TONE_OPTIONS.map(t => (
            <button
              key={t.id}
              onClick={() => setData(prev => ({ ...prev, tone: t.id }))}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                data.tone === t.id
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="mt-1 text-xs text-gray-500">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Colors */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Couleurs personnalisees
        </label>
        <p className="mt-1 text-xs text-gray-400">
          Laissez vide pour utiliser les couleurs du design system choisi
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500">Accent</label>
            <input
              type="color"
              value={data.brandColors?.accent || '#5b8cff'}
              onChange={e =>
                setData(prev => ({
                  ...prev,
                  brandColors: { ...prev.brandColors, accent: e.target.value },
                }))
              }
              className="mt-1 h-10 w-full rounded-lg border"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Background</label>
            <input
              type="color"
              value={data.brandColors?.bg || '#0a0a0f'}
              onChange={e =>
                setData(prev => ({
                  ...prev,
                  brandColors: { ...prev.brandColors, bg: e.target.value },
                }))
              }
              className="mt-1 h-10 w-full rounded-lg border"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Texte</label>
            <input
              type="color"
              value={data.brandColors?.text || '#f0f0f5'}
              onChange={e =>
                setData(prev => ({
                  ...prev,
                  brandColors: { ...prev.brandColors, text: e.target.value },
                }))
              }
              className="mt-1 h-10 w-full rounded-lg border"
            />
          </div>
        </div>
      </div>

      {/* Reference URLs */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Sites de reference
        </label>
        <p className="mt-1 text-xs text-gray-400">
          L'IA s'inspirera du style de ces sites pour generer le contenu
        </p>
        <div className="mt-2 space-y-2">
          {(data.referenceUrls || []).map((url, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm"
              />
              <button
                onClick={() => removeReferenceUrl(idx)}
                className="rounded-lg border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            </div>
          ))}
          <button
            onClick={addReferenceUrl}
            className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-brand hover:text-brand"
          >
            + Ajouter un site de reference
          </button>
        </div>
      </div>

      {/* Pages Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Pages a generer
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AVAILABLE_PAGES.map(page => (
            <button
              key={page.id}
              onClick={() => !page.required && togglePage(page.id)}
              disabled={page.required}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                (data.pages || []).includes(page.id)
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-gray-200 hover:border-gray-300'
              } ${page.required ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{page.label}</span>
                {page.required && <span className="text-xs text-gray-400">Requis</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Product Count */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nombre de produits a sourcer
        </label>
        <input
          type="number"
          value={data.productCount || 12}
          onChange={e => setData(prev => ({ ...prev, productCount: Number(e.target.value) }))}
          min="4"
          max="50"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-xs text-gray-400">
          Entre 4 et 50 produits. Plus = plus long a generer.
        </p>
      </div>

      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
        💡 Ces options permettent un controle total sur le style et le contenu genere par l'IA.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Summary
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
        <SummaryCard label="Design System" value={data.designSystemId} />
        <SummaryCard label="Nom" value={data.shopName} />
        <SummaryCard label="Slug" value={data.slug} />
        <SummaryCard label="Port" value={String(data.port)} />
        <SummaryCard label="Dark mode" value={data.darkMode ? 'Oui' : 'Non'} />
        {data.tagline && <SummaryCard label="Tagline" value={data.tagline} />}
        {data.tone && <SummaryCard label="Ton" value={data.tone} />}
        <SummaryCard label="Pages" value={`${(data.pages || []).length} pages`} />
        <SummaryCard label="Produits" value={`${data.productCount || 12} produits`} />
        {(data.referenceUrls || []).length > 0 && (
          <SummaryCard label="References" value={`${data.referenceUrls!.length} site(s)`} />
        )}
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
  deployError,
  logs,
  onReset,
}: {
  statuses: Record<string, 'pending' | 'running' | 'done' | 'error'>;
  deployedUrl: string;
  deployError: string;
  logs: string[];
  onReset: () => void;
}) {
  const allDone = DEPLOY_STEPS.every(s => statuses[s.id] === 'done');
  const hasError = Object.values(statuses).some(s => s === 'error') || !!deployError;
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Deploiement</h3>

      <div className="space-y-2">
        {DEPLOY_STEPS.map((step, i) => {
          const status = statuses[step.id];
          return (
            <div key={step.id} className={`flex items-center gap-3 rounded-lg border p-3 ${
              status === 'error' ? 'border-red-200 bg-red-50' : ''
            }`}>
              {status === 'pending' && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
                  {i + 1}
                </span>
              )}
              {status === 'running' && <Spinner />}
              {status === 'done' && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-600">
                  ✓
                </span>
              )}
              {status === 'error' && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">
                  ✗
                </span>
              )}
              <span className={`text-sm ${
                status === 'pending' ? 'text-gray-400'
                  : status === 'running' ? 'font-medium text-brand'
                  : status === 'error' ? 'font-medium text-red-600'
                  : 'text-gray-700'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {logs.length > 0 && (
        <div>
          <button
            onClick={() => setShowLogs(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showLogs ? '▼ Masquer les logs' : '▶ Voir les logs'}
          </button>
          {showLogs && (
            <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400">
              {logs.join('\n')}
            </pre>
          )}
        </div>
      )}

      {hasError && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-700">
            {deployError || 'Une erreur est survenue pendant le deploiement.'}
          </p>
          <button
            onClick={onReset}
            className="mt-3 rounded-lg border px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-white"
          >
            Reessayer
          </button>
        </div>
      )}

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
