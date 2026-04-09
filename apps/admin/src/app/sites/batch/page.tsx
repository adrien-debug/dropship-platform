'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BatchItem {
  name: string;
  niche: string;
  market: string;
  positioning: string;
  design_system: string;
}

const DESIGN_SYSTEMS = [
  'swiss', 'cyber', 'avant', 'radical', 'chrome',
  'ds-01-minimal-white', 'ds-02-neo-tokyo', 'ds-03-earth-organic',
  'ds-04-bold-pop', 'ds-05-classic-commerce', 'ds-06-luxury-gold',
  'ds-07-sport-energy', 'ds-08-pastel-bloom', 'ds-09-tech-dark', 'ds-10-streetwear',
];

const MARKETS = ['FR', 'US', 'EU', 'UK', 'WORLD'];
const POSITIONINGS = ['Budget', 'Milieu de gamme', 'Premium'];

const PRESET_NICHES = [
  { niche: 'luxury watches', name: 'ChronoLux', ds: 'chrome' },
  { niche: 'anime figurines', name: 'OtakuStore', ds: 'ds-02-neo-tokyo' },
  { niche: 'skincare beauty', name: 'GlowUp', ds: 'ds-08-pastel-bloom' },
  { niche: 'tech gadgets', name: 'TechVault', ds: 'cyber' },
  { niche: 'streetwear fashion', name: 'UrbanDrop', ds: 'radical' },
  { niche: 'home decor', name: 'NestCraft', ds: 'ds-03-earth-organic' },
  { niche: 'sport fitness', name: 'FitGear', ds: 'ds-07-sport-energy' },
  { niche: 'jewelry accessories', name: 'ShineBox', ds: 'ds-06-luxury-gold' },
];

export default function BatchCreatorPage() {
  const router = useRouter();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [csvText, setCsvText] = useState('');
  const [genCount, setGenCount] = useState(5);
  const [genNiche, setGenNiche] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ queued: number } | null>(null);

  const addItem = (item: Partial<BatchItem>) => {
    setItems(prev => [...prev, {
      name: item.name || 'New Store',
      niche: item.niche || '',
      market: item.market || 'FR',
      positioning: item.positioning || 'Milieu de gamme',
      design_system: item.design_system || 'swiss',
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } as BatchItem : item));
  };

  const parseCsv = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    const parsed: BatchItem[] = [];
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const niche = parts[0] ?? '';
        parsed.push({
          niche,
          name: parts[1] || niche.replace(/\b\w/g, c => c.toUpperCase()) + ' Store',
          market: parts[2] || 'FR',
          positioning: parts[3] || 'Milieu de gamme',
          design_system: parts[4] || 'swiss',
        });
      }
    }
    setItems(prev => [...prev, ...parsed]);
    setCsvText('');
  };

  const generateBatch = () => {
    const baseNiche = genNiche || 'general';
    const suffixes = ['Pro', 'Shop', 'Hub', 'Store', 'Lab', 'Box', 'Drop', 'Vault', 'Zone', 'Central'];
    for (let i = 0; i < genCount; i++) {
      const market = MARKETS[i % MARKETS.length];
      const ds = DESIGN_SYSTEMS[i % DESIGN_SYSTEMS.length];
      const suffix = suffixes[i % suffixes.length];
      const word = baseNiche.split(' ')[0] ?? 'Store';
      const name = `${word.replace(/\b\w/g, c => c.toUpperCase())}${suffix}`;
      addItem({ name, niche: baseNiche, market, design_system: ds });
    }
  };

  const submitBatch = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/sites/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      const data = await res.json();
      setResult({ queued: data.queued ?? items.length });
      setItems([]);
    } catch {
      setResult({ queued: 0 });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Site Creator</h2>
          <p className="text-sm text-gray-500">Creer des sites en masse via la build queue</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={submitBatch}
            disabled={submitting}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Envoi...' : `Lancer ${items.length} site${items.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {result && (
        <div className="rounded-xl border bg-green-50 p-4 text-center">
          <p className="text-lg font-bold text-green-700">{result.queued} site(s) ajoutes a la queue</p>
          <button onClick={() => router.push('/sites')} className="mt-2 text-sm text-green-600 underline">Voir les sites</button>
        </div>
      )}

      {/* Quick presets */}
      <div className="rounded-xl border bg-gray-50 p-4">
        <p className="mb-3 text-sm font-medium text-gray-600">Presets rapides :</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_NICHES.map(preset => (
            <button
              key={preset.niche}
              onClick={() => addItem({ name: preset.name, niche: preset.niche, design_system: preset.ds })}
              className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            >
              + {preset.name} ({preset.niche})
            </button>
          ))}
        </div>
      </div>

      {/* Generator */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold">Generateur automatique</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={genNiche}
            onChange={e => setGenNiche(e.target.value)}
            placeholder="Niche (ex: bijoux, tech, sport)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={genCount}
            onChange={e => setGenCount(Number(e.target.value))}
            min={1}
            max={50}
            className="w-20 rounded-lg border px-3 py-2 text-sm text-center"
          />
          <button onClick={generateBatch} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Generer {genCount} sites
          </button>
        </div>
      </div>

      {/* CSV import */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Import CSV</p>
        <p className="mb-3 text-xs text-gray-400">Format: niche, nom, marche, positionnement, design_system</p>
        <div className="flex gap-3">
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="luxury watches, ChronoLux, FR, Premium, chrome&#10;anime figurines, OtakuDrop, US, Milieu de gamme, ds-02-neo-tokyo"
            rows={3}
            className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono"
          />
          <button onClick={parseCsv} disabled={!csvText.trim()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            Importer CSV
          </button>
        </div>
      </div>

      {/* Queue preview */}
      {items.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">{items.length} site(s) a creer</p>
          </div>
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-xs text-gray-400">{idx + 1}</span>
                <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-40 rounded border px-2 py-1 text-sm" />
                <input value={item.niche} onChange={e => updateItem(idx, 'niche', e.target.value)} className="flex-1 rounded border px-2 py-1 text-sm" />
                <select value={item.market} onChange={e => updateItem(idx, 'market', e.target.value)} className="rounded border px-2 py-1 text-xs">
                  {MARKETS.map(m => <option key={m}>{m}</option>)}
                </select>
                <select value={item.positioning} onChange={e => updateItem(idx, 'positioning', e.target.value)} className="rounded border px-2 py-1 text-xs">
                  {POSITIONINGS.map(p => <option key={p}>{p}</option>)}
                </select>
                <select value={item.design_system} onChange={e => updateItem(idx, 'design_system', e.target.value)} className="rounded border px-2 py-1 text-xs">
                  {DESIGN_SYSTEMS.map(ds => <option key={ds}>{ds}</option>)}
                </select>
                <button onClick={() => removeItem(idx)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
