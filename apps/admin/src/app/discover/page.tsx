'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface TrendingProduct {
  title: string;
  image: string;
  price: number;
  sell_price: number;
  supplier: string;
  category: string;
  trend_score: number;
  source: string;
  source_url: string;
  shipping_days: string;
}

interface Source {
  name: string;
  url: string;
}

const CATEGORIES = [
  { id: 'cosmetique', label: 'Cosmetique', icon: '💄' },
  { id: 'figurines', label: 'Figurines', icon: '🎭' },
  { id: 'tech', label: 'Tech & Gadgets', icon: '📱' },
  { id: 'mode', label: 'Mode', icon: '👕' },
  { id: 'maison', label: 'Maison', icon: '🏠' },
  { id: 'sport', label: 'Sport', icon: '🏋️' },
  { id: 'bijoux', label: 'Bijoux', icon: '💍' },
];

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400">Chargement...</div>}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<TrendingProduct[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const search = useCallback(async (q?: string, cat?: string | null) => {
    const searchQuery = q ?? query;
    const searchCat = cat !== undefined ? cat : category;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (searchCat) params.set('category', searchCat);

      const res = await fetch(`/api/trending?${params.toString()}`);
      const data = await res.json();
      setResults(data.products ?? []);
      setSources(data.sources ?? []);
      setSelected(new Set());
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((_, i) => i)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Decouverte produits</h2>
          <p className="text-sm text-gray-500">Trouvez les produits tendance chez les fournisseurs</p>
        </div>
        {selected.size > 0 && (
          <button
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            onClick={() => {
              const products = Array.from(selected).map(i => results[i]);
              const encoded = encodeURIComponent(JSON.stringify(products));
              window.location.href = `/products/import?bulk=${encoded}`;
            }}
          >
            Importer {selected.size} produit{selected.size > 1 ? 's' : ''} dans Medusa
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Tapez un produit, une niche, un mot-cle..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
        />
        <button
          onClick={() => search()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '...' : 'Rechercher'}
        </button>
        <button
          onClick={() => { setQuery(''); setCategory(null); search('trending', null); }}
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm hover:bg-gray-50"
        >
          🎲 Aleatoire
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              const newCat = category === cat.id ? null : cat.id;
              setCategory(newCat);
              search(query || cat.id, newCat);
            }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              category === cat.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{results.length} produits trouves</p>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {selected.size === results.length ? 'Tout deselectionner' : 'Tout selectionner'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((product, idx) => (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`group cursor-pointer rounded-xl border p-3 transition ${
                  selected.has(idx) ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'bg-white hover:shadow-md'
                }`}
              >
                {/* Selection indicator */}
                <div className="mb-2 flex items-center justify-between">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                    selected.has(idx) ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'
                  }`}>
                    {selected.has(idx) && '✓'}
                  </div>
                  <span className="text-[10px] font-medium text-orange-500">🔥 {product.trend_score}/100</span>
                </div>

                {product.image && (
                  <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                )}

                <h4 className="mb-1 line-clamp-2 text-sm font-medium">{product.title}</h4>

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400 line-through">{product.price.toFixed(2)}€</span>
                  <span className="text-sm font-bold text-green-600">{product.sell_price.toFixed(2)}€</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                    marge +{((product.sell_price - product.price) / product.price * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5">{product.supplier}</span>
                  <span>📦 {product.shipping_days}</span>
                </div>

                {/* Trend bar */}
                <div className="mb-2">
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                      style={{ width: `${Math.min(product.trend_score, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Source with link */}
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
                >
                  📊 {product.source} →
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sources section */}
      {sources.length > 0 && (
        <div className="rounded-xl border bg-gray-50 p-4">
          <h4 className="mb-2 text-sm font-medium text-gray-700">Sources des donnees</h4>
          <div className="flex flex-wrap gap-3">
            {sources.map(s => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600"
              >
                {s.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
