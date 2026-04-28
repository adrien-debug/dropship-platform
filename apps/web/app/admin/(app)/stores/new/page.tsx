'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [maxProducts, setMaxProducts] = useState(10);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ slug: string; storeName: string; productCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    const n = searchParams.get('niche');
    const s = searchParams.get('name');
    if (n) setNiche(n);
    if (s) setStoreName(s);
  }, [searchParams]);

  const addLog = (event: AgentEvent) => {
    const line: LogLine = { id: counterRef.current++, type: event.type, message: event.message, ts: new Date().toLocaleTimeString() };
    setLogs(prev => [...prev, line]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    if (event.type === 'step') setProgress(p => Math.min(p + 15, 85));
    if (event.type === 'progress' && event.data?.imported && event.data?.total) {
      const pct = Math.round((Number(event.data.imported) / Number(event.data.total)) * 100);
      setProgress(70 + Math.round(pct * 0.25));
    }
    if (event.type === 'success') setProgress(100);
  };

  const launch = async () => {
    if (!niche.trim() || !storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(5);
    startTimeRef.current = Date.now();

    try {
      const res = await fetch('/api/agent/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, storeName, maxProducts, language }),
      });

      if (!res.ok || !res.body) {
        setError('Erreur serveur — vérifiez ANTHROPIC_API_KEY.');
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
              setResult({ slug: event.data.slug as string, storeName: event.data.storeName as string, productCount: event.data.productCount as number });
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

  const elapsed = running && startTimeRef.current
    ? Math.round((Date.now() - startTimeRef.current) / 1000)
    : 0;

  const iconFor = (type: AgentEvent['type']) => ({ step: '▶', progress: '·', success: '✅', error: '❌', done: '■' }[type] || '·');
  const colorFor = (type: AgentEvent['type']) => ({ step: 'text-blue-400', progress: 'text-zinc-500', success: 'text-green-400', error: 'text-red-400', done: 'text-zinc-600' }[type] || 'text-zinc-500');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/stores" className="text-sm text-zinc-400 hover:underline">← Stores</Link>
        <h2 className="text-2xl font-bold mt-1">Nouveau store IA</h2>
        <p className="text-sm text-zinc-500 mt-1">
          L&apos;agent cherche des produits sur AliExpress + CJ (ou les génère via Claude), les enrichit et crée le store Medusa + storefront complet.
        </p>
      </div>

      <div className="border rounded-xl p-6 space-y-5 bg-white shadow-sm">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Niche / mot-clé</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {NICHE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setNiche(p.value)}
                disabled={running}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  niche === p.value
                    ? 'bg-black text-white border-black'
                    : 'border-zinc-200 hover:border-zinc-400 text-zinc-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={niche}
            onChange={e => setNiche(e.target.value)}
            placeholder="ou entrez votre propre niche..."
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            disabled={running}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nom du store</label>
          <input
            type="text"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder="ex: ZenShop, PhoneWorld Pro, LaBoutiqueAnimaux"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            disabled={running}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Produits (3–25)</label>
            <input type="number" value={maxProducts} onChange={e => setMaxProducts(Number(e.target.value))} min={3} max={25}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Langue</label>
            <select value={language} onChange={e => setLanguage(e.target.value as 'fr' | 'en')}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running}>
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>

        <button onClick={launch} disabled={running || !niche.trim() || !storeName.trim()}
          className="w-full bg-black text-white py-3 rounded-lg font-medium text-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Agent en cours... ({elapsed}s)
            </span>
          ) : '🤖 Lancer l\'agent IA'}
        </button>
      </div>

      {(running || result) && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{progress < 100 ? 'Création en cours...' : 'Terminé !'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"/>
              <div className="w-3 h-3 rounded-full bg-yellow-500"/>
              <div className="w-3 h-3 rounded-full bg-green-500"/>
            </div>
            <span className="text-zinc-400 text-xs ml-2 font-mono">agent · {storeName || 'store'}</span>
            {running && <span className="ml-auto text-xs text-zinc-500 font-mono">{elapsed}s</span>}
          </div>
          <div className="bg-zinc-950 p-4 h-72 overflow-y-auto font-mono text-xs space-y-0.5">
            {logs.map(log => (
              <div key={log.id} className={`flex gap-2 ${colorFor(log.type)}`}>
                <span className="opacity-30 shrink-0 w-16">{log.ts}</span>
                <span className="shrink-0">{iconFor(log.type)}</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef}/>
          </div>
        </div>
      )}

      {result && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold text-green-900">Store créé !</h3>
          <p className="text-green-700 text-sm"><strong>{result.productCount} produits</strong> dans <strong>{result.storeName}</strong></p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href={`/shop/${result.slug}`} target="_blank"
              className="bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-800">
              Voir le store →
            </Link>
            <Link href="/admin/stores"
              className="border border-green-300 text-green-800 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-100">
              Tous les stores
            </Link>
            <button onClick={() => { setResult(null); setLogs([]); setProgress(0); setNiche(''); setStoreName(''); }}
              className="border border-zinc-300 text-zinc-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-50">
              Créer un autre
            </button>
          </div>
          <p className="text-xs text-green-600 font-mono">/shop/{result.slug}</p>
        </div>
      )}

      {error && !result && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4">
          <p className="text-red-800 text-sm font-medium">❌ {error}</p>
        </div>
      )}
    </div>
  );
}

export default function NewStorePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Chargement...</div>}>
      <NewStoreForm />
    </Suspense>
  );
}
