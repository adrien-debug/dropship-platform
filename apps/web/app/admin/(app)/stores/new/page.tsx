'use client';

import { useState, useRef } from 'react';
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
  data?: Record<string, unknown>;
  ts: string;
}

export default function NewStorePage() {
  const [niche, setNiche] = useState('');
  const [storeName, setStoreName] = useState('');
  const [maxProducts, setMaxProducts] = useState(12);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<{ slug: string; storeName: string; productCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (event: AgentEvent) => {
    const line: LogLine = {
      id: counterRef.current++,
      type: event.type,
      message: event.message,
      data: event.data,
      ts: new Date().toLocaleTimeString(),
    };
    setLogs(prev => [...prev, line]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const launch = async () => {
    if (!niche.trim() || !storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/agent/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, storeName, maxProducts, language }),
      });

      if (!res.ok || !res.body) {
        setError('Erreur serveur — vérifiez que ANTHROPIC_API_KEY est configuré.');
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
            if (event.type === 'error') {
              setError(event.message);
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    }

    setRunning(false);
  };

  const iconFor = (type: AgentEvent['type']) => {
    if (type === 'step') return '▶';
    if (type === 'progress') return '·';
    if (type === 'success') return '✅';
    if (type === 'error') return '❌';
    return '·';
  };

  const colorFor = (type: AgentEvent['type']) => {
    if (type === 'step') return 'text-blue-400';
    if (type === 'progress') return 'text-zinc-400';
    if (type === 'success') return 'text-green-400';
    if (type === 'error') return 'text-red-400';
    return 'text-zinc-500';
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/admin/stores" className="text-sm text-zinc-500 hover:underline">← Retour aux stores</Link>
        <h2 className="text-2xl font-bold mt-2">Créer un store avec l&apos;agent IA</h2>
        <p className="text-sm text-zinc-500 mt-1">
          L&apos;agent recherche des produits sur AliExpress + CJ, les enrichit avec Claude,
          crée le catalogue Medusa et génère le storefront automatiquement.
        </p>
      </div>

      {/* Form */}
      <div className="border rounded-xl p-6 space-y-5 bg-white shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Niche / mot-clé produit *
            </label>
            <input
              type="text"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="ex: phone accessories, home decor, yoga"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Nom du store *
            </label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="ex: PhoneWorld Pro, ZenHome, YogaShop"
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Nombre de produits (3–25)
            </label>
            <input
              type="number"
              value={maxProducts}
              onChange={e => setMaxProducts(Number(e.target.value))}
              min={3}
              max={25}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Langue du store</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as 'fr' | 'en')}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={running}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <button
          onClick={launch}
          disabled={running || !niche.trim() || !storeName.trim()}
          className="w-full bg-black text-white py-3 rounded-lg font-medium text-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Agent en cours...
            </span>
          ) : (
            '🤖 Lancer l\'agent IA'
          )}
        </button>

        <p className="text-xs text-zinc-400 text-center">
          Durée estimée : 2–5 minutes selon le nombre de produits
        </p>
      </div>

      {/* Terminal log */}
      {logs.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-zinc-400 text-xs ml-2 font-mono">agent · {storeName}</span>
          </div>
          <div className="bg-zinc-950 p-4 h-80 overflow-y-auto font-mono text-xs space-y-1">
            {logs.map(log => (
              <div key={log.id} className={`flex gap-2 ${colorFor(log.type)}`}>
                <span className="opacity-40 shrink-0">{log.ts}</span>
                <span className="shrink-0">{iconFor(log.type)}</span>
                <span>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold text-green-900">Store créé avec succès !</h3>
          <p className="text-green-700 text-sm">
            <strong>{result.productCount} produits</strong> importés dans <strong>{result.storeName}</strong>
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/shop/${result.slug}`}
              target="_blank"
              className="bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
            >
              Voir le store →
            </Link>
            <Link
              href="/admin/stores"
              className="border border-green-300 text-green-800 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
            >
              Retour à la liste
            </Link>
          </div>
          <p className="text-xs text-green-600 font-mono">URL : /shop/{result.slug}</p>
        </div>
      )}

      {/* Error */}
      {error && !result && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4">
          <p className="text-red-800 text-sm font-medium">❌ {error}</p>
          <p className="text-red-600 text-xs mt-1">
            Vérifiez que ANTHROPIC_API_KEY est défini dans .env.local et que les APIs fournisseurs sont actives.
          </p>
        </div>
      )}
    </div>
  );
}
