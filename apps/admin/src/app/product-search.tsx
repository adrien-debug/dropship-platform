'use client';

import { useState } from 'react';

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

const TRENDING_CATEGORIES = [
  'cosmetique',
  'figurines',
  'tech',
  'mode',
  'maison',
  'sport',
  'bijoux',
];

export function ProductSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(q?: string, cat?: string) {
    const searchQuery = q ?? query;
    const searchCat = cat ?? category;
    if (!searchQuery && !searchCat) return;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (searchCat) params.set('category', searchCat);

      const res = await fetch(`/api/trending?${params.toString()}`);
      const data = await res.json();
      setResults(data.products ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Decouverte produits</h3>
        <span className="text-xs text-gray-400">Recherche temps reel chez les fournisseurs</span>
      </div>

      {/* Search bar + category pills */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tapez un produit, une niche, une idee..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
          />
        </div>
        <button
          onClick={() => search()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
        <button
          onClick={() => search(undefined, undefined)}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
          title="Produits aleatoires en vogue"
        >
          🎲 Random
        </button>
      </div>

      {/* Category pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TRENDING_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => {
              const newCat = category === cat ? null : cat;
              setCategory(newCat);
              search(query || cat, newCat);
            }}
            className={`rounded-full px-3 py-1 text-sm transition ${
              category === cat
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          Aucun produit trouve. Essayez un autre terme ou une autre categorie.
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((product, idx) => (
            <div key={idx} className="group rounded-xl border bg-white p-3 transition hover:shadow-md">
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
                  +{((product.sell_price - product.price) / product.price * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-gray-100 px-1.5 py-0.5">{product.supplier}</span>
                <span>📦 {product.shipping_days}</span>
              </div>
              {/* Trend score */}
              <div className="mb-2 flex items-center gap-1">
                <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-orange-400"
                    style={{ width: `${Math.min(product.trend_score, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-orange-500">🔥 {product.trend_score}</span>
              </div>
              {/* Source */}
              <div className="flex items-center justify-between">
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-500 underline hover:text-blue-700"
                >
                  Source: {product.source}
                </a>
                <button
                  onClick={() => {
                    window.location.href = `/products/import?product=${encodeURIComponent(JSON.stringify({
                      title: product.title,
                      image: product.image,
                      price: product.price,
                      supplier: product.supplier,
                    }))}`;
                  }}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                >
                  + Importer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">
            Tapez un mot-cle ou cliquez sur une categorie pour decouvrir les produits tendance
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Sources : CJ Dropshipping, Google Trends, AliExpress Best Sellers
          </p>
        </div>
      )}
    </div>
  );
}
