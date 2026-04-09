'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface BulkProduct {
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

interface ImportResult {
  title: string;
  status: 'ok' | 'error';
  medusa_id?: string;
  error?: string;
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400">Chargement...</div>}>
      <ImportContent />
    </Suspense>
  );
}

function ImportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<BulkProduct[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [margin, setMargin] = useState(150);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ imported: number; failed: number; results: ImportResult[] } | null>(null);

  useEffect(() => {
    const bulk = searchParams.get('bulk');
    if (bulk) {
      try {
        const parsed = JSON.parse(decodeURIComponent(bulk)) as BulkProduct[];
        setProducts(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
      } catch { /* bad payload */ }
    }
  }, [searchParams]);

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((_, i) => i)));
  };

  const calcSellPrice = useCallback((cost: number) => {
    return Math.max(9.99, Math.round(cost * (margin / 100) * 100) / 100);
  }, [margin]);

  const doImport = async () => {
    const toImport = Array.from(selected).map(i => {
      const p = products[i]!;
      return { ...p, sell_price: calcSellPrice(p.price), margin_pct: margin };
    });
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: toImport }),
      });
      const data = await res.json();
      setResults(data);
    } catch {
      setResults({ imported: 0, failed: toImport.length, results: [] });
    } finally {
      setImporting(false);
    }
  };

  if (products.length === 0 && !results) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-lg text-gray-500">Aucun produit a importer</p>
        <button onClick={() => router.push('/discover')} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          Aller sur Discover
        </button>
      </div>
    );
  }

  if (results) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Resultat de l&apos;import</h2>
          <div className="flex gap-3">
            <button onClick={() => router.push('/products')} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              Voir les produits
            </button>
            <button onClick={() => router.push('/discover')} className="rounded-lg border px-5 py-2.5 text-sm hover:bg-gray-50">
              Continuer la recherche
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-green-50 p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{results.imported}</p>
            <p className="text-sm text-green-600">Importes</p>
          </div>
          <div className="rounded-xl border bg-red-50 p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{results.failed}</p>
            <p className="text-sm text-red-600">Echoues</p>
          </div>
          <div className="rounded-xl border bg-gray-50 p-4 text-center">
            <p className="text-3xl font-bold text-gray-700">{results.imported + results.failed}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
        </div>

        <div className="space-y-2">
          {results.results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${r.status === 'ok' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <span className="text-sm font-medium">{r.title}</span>
              <span className={`text-xs font-medium ${r.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {r.status === 'ok' ? 'OK' : r.error}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Importer des produits</h2>
          <p className="text-sm text-gray-500">{products.length} produits depuis Discover → Supabase + Medusa</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">
            {selected.size === products.length ? 'Tout deselectionner' : 'Tout selectionner'}
          </button>
          <button
            onClick={doImport}
            disabled={importing || selected.size === 0}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? `Import en cours (${selected.size})...` : `Importer ${selected.size} produit${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Margin slider */}
      <div className="flex items-center gap-4 rounded-xl border bg-gray-50 p-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Marge :</label>
        <input
          type="range"
          min={110}
          max={400}
          step={10}
          value={margin}
          onChange={e => setMargin(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-16 rounded-lg bg-white border px-3 py-1.5 text-center text-sm font-bold text-green-700">{margin}%</span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, idx) => {
          const sellPrice = calcSellPrice(product.price);
          const profit = sellPrice - product.price;
          return (
            <div
              key={idx}
              onClick={() => toggleSelect(idx)}
              className={`group cursor-pointer rounded-xl border p-3 transition ${
                selected.has(idx) ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'bg-white hover:shadow-md'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
                  selected.has(idx) ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                }`}>
                  {selected.has(idx) && '✓'}
                </div>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{product.supplier}</span>
              </div>

              {product.image && (
                <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img src={product.image} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}

              <h4 className="mb-2 line-clamp-2 text-sm font-medium">{product.title}</h4>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Cout fournisseur</span>
                  <span className="font-medium">{product.price.toFixed(2)}€</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Prix de vente</span>
                  <span className="font-bold text-green-700">{sellPrice.toFixed(2)}€</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Profit/unite</span>
                  <span className="font-bold text-blue-700">+{profit.toFixed(2)}€</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-gray-100 px-1.5 py-0.5">{product.category}</span>
                <span>📦 {product.shipping_days}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
