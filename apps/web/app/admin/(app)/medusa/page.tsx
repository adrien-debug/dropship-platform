'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  category: string;
  supplier: string;
  medusa_product_id?: string;
  published_to_medusa_at?: string;
  status: string;
}

export default function MedusaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<{ ok: boolean; message: string } | null>(null);
  const [stats, setStats] = useState<{ publishedToMedusa: number; notPublished: number } | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadConfig();
    loadProducts();
    loadStats();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch('/api/medusa/status');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch {
      // détail au moment du publish
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products?status=all&limit=50');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/medusa/publish');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {
      // Ignore
    }
  }

  async function publishSelected() {
    if (selectedProducts.size === 0) {
      alert('Sélectionnez au moins un produit');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/medusa/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          autoPublish: false,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        alert(`${data.published.success} produits publiés sur Medusa`);
        loadProducts();
        loadStats();
        setSelectedProducts(new Set());
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) {
      alert('Erreur de connexion');
    } finally {
      setPublishing(false);
    }
  }

  function toggleSelection(productId: string) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  }

  function selectAll() {
    const unpublished = products.filter(p => !p.medusa_product_id);
    if (selectedProducts.size === unpublished.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(unpublished.map(p => p.id)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Medusa Integration</h2>
          <p className="text-gray-600">
            Backend:{' '}
            {process.env.NEXT_PUBLIC_MEDUSA_URL ||
              '(définir NEXT_PUBLIC_MEDUSA_URL pour afficher l’URL publique Medusa)'}
          </p>
        </div>
        {config && (
          <div className={`px-3 py-1 rounded text-sm ${config.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {config.ok ? '✓ Connecté' : '✗ Non configuré'}
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.publishedToMedusa}</p>
            <p className="text-sm text-blue-800">Publiés sur Medusa</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-600">{stats.notPublished}</p>
            <p className="text-sm text-gray-800">Non publiés</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 hover:underline"
          >
            {selectedProducts.size > 0 ? 'Tout désélectionner' : 'Tout sélectionner (non publiés)'}
          </button>
          <span className="text-sm text-gray-600">
            {selectedProducts.size} sélectionné(s)
          </span>
        </div>
        <button
          onClick={publishSelected}
          disabled={publishing || selectedProducts.size === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {publishing ? 'Publication...' : 'Publier sur Medusa'}
        </button>
      </div>

      {/* Results */}
      {result?.published?.errors && result.published.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium mb-2">Erreurs:</p>
          <ul className="text-sm text-red-600 space-y-1">
            {result.published.errors.map((err: any, i: number) => (
              <li key={i}>{err.title}: {err.error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Sélection</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Produit</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Catégorie</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Prix</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status Medusa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className={product.medusa_product_id ? 'bg-green-50' : ''}
                >
                  <td className="px-4 py-3">
                    {!product.medusa_product_id && (
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleSelection(product.id)}
                        className="w-4 h-4"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.title}</div>
                    <div className="text-sm text-gray-500">{product.supplier}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{product.category}</td>
                  <td className="px-4 py-3 text-sm">
                    {(product.price_cents / 100).toFixed(2)} €
                  </td>
                  <td className="px-4 py-3">
                    {product.medusa_product_id ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        ✓ Publié
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                        Non publié
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {products.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-12">
          Aucun produit. Importez d'abord des produits depuis /admin/suppliers
        </p>
      )}
    </div>
  );
}
