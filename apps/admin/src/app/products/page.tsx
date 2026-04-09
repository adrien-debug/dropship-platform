'use client';

import { useCallback, useEffect, useState } from 'react';

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  cost_cents: number | null;
  category: string;
  in_stock: boolean;
  image_urls: string[];
  supplier: string | null;
  catalog_id: string | null;
  external_id: string | null;
  site_id: string | null;
  synced_at: string | null;
  shipping_days_min: number | null;
  shipping_days_max: number | null;
}

type SupplierFilter = '' | 'cjdropshipping' | 'aliexpress' | 'legacy';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('');
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (filter) params.set('q', filter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(p => {
    if (supplierFilter === 'cjdropshipping') return p.supplier === 'cjdropshipping' || p.supplier === 'cj';
    if (supplierFilter === 'aliexpress') return p.supplier === 'aliexpress';
    if (supplierFilter === 'legacy') return !p.supplier;
    return true;
  });

  const syncedCount = products.filter(p => p.supplier).length;
  const aliexpressCount = products.filter(p => p.supplier === 'aliexpress').length;
  const cjCount = products.filter(p => p.supplier === 'cjdropshipping' || p.supplier === 'cj').length;
  const legacyCount = products.filter(p => !p.supplier).length;
  const avgMargin = (() => {
    const withCost = products.filter(p => p.cost_cents && p.cost_cents > 0);
    if (withCost.length === 0) return 0;
    const margins = withCost.map(p => ((p.price_cents - (p.cost_cents ?? 0)) / p.price_cents) * 100);
    return Math.round(margins.reduce((a, b) => a + b, 0) / margins.length);
  })();

  const margin = (p: Product) => {
    if (!p.cost_cents || p.cost_cents <= 0) return '—';
    return `${Math.round(((p.price_cents - p.cost_cents) / p.price_cents) * 100)}%`;
  };

  const formatEur = (c: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    await fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{total} produits en base</p>
        </div>
        <a
          href="/products/add"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          + Ajouter un produit
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-bold">{total}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">AliExpress</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">{aliexpressCount}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">CJ Dropshipping</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{cjCount}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Marge moy.</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{avgMargin}%</p>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value as SupplierFilter)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Tous</option>
          <option value="aliexpress">AliExpress</option>
          <option value="cjdropshipping">CJ Dropshipping</option>
          <option value="legacy">Legacy (static)</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Aucun produit trouvé</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const m = margin(p);
            const catColor =
              p.category.includes('Beauty') ? 'bg-pink-100 text-pink-700' :
              p.category.includes('Wellness') ? 'bg-emerald-100 text-emerald-700' :
              p.category.includes('Home') ? 'bg-amber-100 text-amber-700' :
              p.category.includes('Tech') ? 'bg-blue-100 text-blue-700' :
              p.category.includes('Pet') ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700';

            return (
              <div
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-gray-50">
                  {p.image_urls?.[0] ? (
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-gray-300">
                      {p.category.includes('Beauty') ? '🧴' :
                       p.category.includes('Wellness') ? '💆' :
                       p.category.includes('Home') ? '🏠' :
                       p.category.includes('Tech') ? '📱' :
                       p.category.includes('Pet') ? '🐶' :
                       '📦'}
                    </div>
                  )}

                  {/* Stock badge */}
                  <div className="absolute right-2 top-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      p.in_stock ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                    }`}>
                      {p.in_stock ? 'En stock' : 'Rupture'}
                    </span>
                  </div>

                  {/* Marge badge */}
                  {m !== '—' && (
                    <div className="absolute left-2 top-2">
                      <span className="inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-green-400">
                        +{m}
                      </span>
                    </div>
                  )}

                  {/* Delete on hover */}
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="absolute right-2 bottom-2 rounded-full bg-white/90 p-1.5 text-gray-400 opacity-0 shadow transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Infos */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>
                      {p.category}
                    </span>
                    {p.supplier && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        {p.supplier === 'cjdropshipping' ? 'CJ' : p.supplier}
                      </span>
                    )}
                  </div>

                  <h3 className="mb-3 text-sm font-semibold leading-snug text-gray-900">
                    {p.name}
                  </h3>

                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{formatEur(p.price_cents)}</p>
                      {p.cost_cents ? (
                        <p className="text-xs text-gray-400">
                          Coût {formatEur(p.cost_cents)} · Profit{' '}
                          <span className="font-medium text-green-600">
                            {formatEur(p.price_cents - p.cost_cents)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    {p.synced_at && (
                      <p className="text-[10px] text-gray-400">
                        {new Date(p.synced_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
