'use client';

import { useCallback, useEffect, useState } from 'react';

interface Catalog {
  id: string;
  site_id: string;
  name: string;
  supplier: string;
  keywords: string[];
  margin: number;
  product_count: number;
  auto_sync: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

interface Site {
  id: string;
  name: string;
}

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [sites, setSites] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, allSites] = await Promise.all([
        fetch('/api/catalogs').then(r => r.json()).then(d => d.catalogs ?? []),
        fetch('/api/sites').then(r => r.json()).then(d => d.sites ?? []),
      ]);
      setCatalogs(cats);
      const m = new Map<string, string>();
      allSites.forEach((s: Site) => m.set(s.id, s.name));
      setSites(m);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerSync = async (catalogId: string) => {
    setSyncing(catalogId);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResult({
          id: catalogId,
          ok: true,
          msg: `${data.products_added ?? data.products_found ?? 0} produits synchronisés (${data.duration_ms ?? 0}ms)`,
        });
        await fetchData();
      } else {
        setSyncResult({ id: catalogId, ok: false, msg: data.error ?? 'Sync failed' });
      }
    } catch (err) {
      setSyncResult({ id: catalogId, ok: false, msg: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setSyncing(null);
    }
  };

  const totalProducts = catalogs.reduce((sum, c) => sum + (c.product_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catalogs</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Catalogs</p>
          <p className="mt-1 text-2xl font-bold">{catalogs.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Produits sync</p>
          <p className="mt-1 text-2xl font-bold">{totalProducts}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Fournisseurs</p>
          <p className="mt-1 text-2xl font-bold">{new Set(catalogs.map(c => c.supplier)).size}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : catalogs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p className="text-lg">No catalogs yet</p>
          <p className="mt-1 text-sm">Catalogs are created via the A-Z pipeline or shops/setup API</p>
        </div>
      ) : (
        <div className="space-y-4">
          {catalogs.map(cat => (
            <div key={cat.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <p className="text-sm text-gray-500">
                    {sites.get(cat.site_id) ?? cat.site_id.slice(0, 8)} · {cat.supplier} · {cat.margin}% marge · {cat.product_count} produits
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cat.keywords.map((kw, i) => (
                      <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{kw}</span>
                    ))}
                  </div>
                  {cat.last_sync_at && (
                    <p className="mt-1 text-xs text-gray-400">
                      Dernier sync: {new Date(cat.last_sync_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                  {cat.last_sync_error && (
                    <p className="mt-1 text-xs text-red-500">Erreur: {cat.last_sync_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${cat.auto_sync ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.auto_sync ? 'Auto' : 'Manual'}
                  </span>
                  <button
                    onClick={() => triggerSync(cat.id)}
                    disabled={syncing === cat.id}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {syncing === cat.id ? 'Sync...' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {syncResult?.id === cat.id && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                  syncResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {syncResult.ok ? '✓' : '✗'} {syncResult.msg}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
