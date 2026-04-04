'use client';

import { useEffect, useState } from 'react';

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
}

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/catalogs').then(r => r.json()).then(d => { setCatalogs(d.catalogs ?? []); setLoading(false); });
  }, []);

  const triggerSync = async (catalogId: string) => {
    await fetch(`/api/catalogs/${catalogId}/sync`, { method: 'POST' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catalogues</h2>
        <a href="/catalogs/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
          + Nouveau catalogue
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : catalogs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p>Aucun catalogue. Creez-en un pour commencer a synchroniser des produits.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {catalogs.map(cat => (
            <div key={cat.id} className="flex items-center justify-between rounded-xl border bg-white p-6 shadow-sm">
              <div>
                <h3 className="font-semibold">{cat.name}</h3>
                <p className="text-sm text-gray-500">
                  {cat.supplier} · Marge {cat.margin}% · {cat.product_count} produits · Keywords: {cat.keywords.join(', ')}
                </p>
                {cat.last_sync_at && (
                  <p className="text-xs text-gray-400">Dernier sync: {new Date(cat.last_sync_at).toLocaleString('fr-FR')}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => triggerSync(cat.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Sync
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
