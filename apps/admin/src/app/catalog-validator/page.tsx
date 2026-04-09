'use client';

import { useState } from 'react';

interface TrendingProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  inStock: boolean;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  supplierCostCents: number;
  source: 'cj' | 'aliexpress';
  trendScore: 'hot' | 'rising' | 'stable';
  repeatPurchase: boolean;
  viralPlatform?: 'tiktok' | 'instagram' | 'youtube';
}

export default function CatalogValidatorPage() {
  const [catalog, setCatalog] = useState<TrendingProduct[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/catalog-2026');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCatalog(data.catalog);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)}€`;
  const calculateMargin = (price: number, cost: number) => 
    `${(((price - cost) / price) * 100).toFixed(0)}%`;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Validation Catalogue Trending 2026
            </h1>
            <p className="mt-2 text-gray-600">
              Vérification des 20 produits validés par la demande
            </p>
          </div>
          <button
            onClick={loadCatalog}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Chargement...' : catalog.length > 0 ? 'Recharger' : 'Charger Catalogue'}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Stats globales */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total Produits</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Marge Moyenne</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{stats.avgMargin}%</p>
            </div>
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">🔥 Hot</p>
              <p className="mt-1 text-3xl font-bold text-orange-600">{stats.trendScores.hot}</p>
            </div>
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">📈 Rising</p>
              <p className="mt-1 text-3xl font-bold text-blue-600">{stats.trendScores.rising}</p>
            </div>
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">🔁 Repeat Purchase</p>
              <p className="mt-1 text-3xl font-bold text-purple-600">{stats.repeatPurchase}</p>
            </div>
          </div>
        )}

        {/* Catégories */}
        {stats && (
          <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Répartition par Catégorie</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Object.entries(stats.categories).map(([cat, count]) => (
                <div key={cat} className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700">{cat}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{count as number}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste des produits */}
        {catalog.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Produits ({catalog.length})
            </h2>
            
            {catalog.map((product, idx) => {
              const margin = calculateMargin(product.priceCents, product.supplierCostCents);
              const trendEmoji = product.trendScore === 'hot' ? '🔥' : product.trendScore === 'rising' ? '📈' : '✅';
              
              return (
                <div
                  key={product.id}
                  className="rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{trendEmoji}</span>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {idx + 1}. {product.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {product.category}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {product.source}
                            </span>
                            {product.repeatPurchase && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                🔁 Repeat Purchase
                              </span>
                            )}
                            {product.viralPlatform && (
                              <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                                📱 {product.viralPlatform}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="mt-3 text-sm text-gray-600">{product.description}</p>
                      
                      <div className="mt-4 grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Prix Vente</p>
                          <p className="mt-1 text-lg font-bold text-gray-900">
                            {formatPrice(product.priceCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Coût Fournisseur</p>
                          <p className="mt-1 text-lg font-medium text-gray-700">
                            {formatPrice(product.supplierCostCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Marge</p>
                          <p className="mt-1 text-lg font-bold text-green-600">{margin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Profit</p>
                          <p className="mt-1 text-lg font-bold text-green-600">
                            {formatPrice(product.priceCents - product.supplierCostCents)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-6 flex flex-col items-end gap-2">
                      {product.inStock ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          ✓ En stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          ✗ Rupture
                        </span>
                      )}
                      {product.imageUrls.length > 0 ? (
                        <span className="text-xs text-green-600">📷 {product.imageUrls.length} image(s)</span>
                      ) : (
                        <span className="text-xs text-orange-600">⚠️ Pas d'images</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        {catalog.length > 0 && (
          <div className="mt-8 flex gap-4">
            <a
              href="/sites/new"
              className="flex-1 rounded-lg bg-green-600 px-6 py-4 text-center font-semibold text-white hover:bg-green-700"
            >
              ✅ Catalogue Validé → Créer le Shop
            </a>
            <button
              onClick={() => {
                const json = JSON.stringify({ catalog, stats }, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'trending-2026-catalog.json';
                a.click();
              }}
              className="rounded-lg border border-gray-300 bg-white px-6 py-4 font-medium text-gray-700 hover:bg-gray-50"
            >
              💾 Exporter JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
