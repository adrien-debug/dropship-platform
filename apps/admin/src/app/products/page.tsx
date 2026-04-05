'use client';

import { useCallback, useEffect, useState } from 'react';

interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  supplierCostCents: number;
  category: string;
  inStock: boolean;
  imageUrls: string[];
  sourceUrl: string;
  source: string;
}

const CATEGORIES = [
  'Figurines', 'Figurines Luffy Gear 5', 'Figurines Shanks', 'Figurines Ace',
  'Figurines Sanji', 'Figurines Nami Robin Hancock', 'Figurines Law', 'Figurines Chopper',
  'T-Shirts', 'Hoodies', 'Vestes Bombers', 'Sneakers', 'Cosplay', 'Chaussettes', 'Casquettes',
  'Mugs', 'Gourdes', 'Coques iPhone', 'Coques AirPods',
  'Porte-cl\u00e9s', 'Posters', 'Sacs', 'Peluches', 'Bijoux',
  'Lampes LED', 'Portefeuilles', 'Stickers', 'Tapis de souris',
  'Couvertures', 'Puzzles', 'Mini Figures', 'Building Blocks',
  'Fruits du Demon', 'Maquettes Bateaux', 'Montres', 'Drapeaux',
  'Cartes TCG', 'Rideaux Tapisseries', 'Goodies', 'Bureau', 'Maison',
];
const STOREFRONT_API = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://100.110.74.114:3100';

const empty: Product = {
  id: '', name: '', description: '', priceCents: 0, supplierCostCents: 0,
  category: 'Figurines', inStock: true, imageUrls: [''], sourceUrl: '', source: 'aliexpress',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${STOREFRONT_API}/api/products?limit=1000`);
      const data = await res.json();
      setProducts(data.items ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter(p => {
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (catFilter && p.category !== catFilter) return false;
    return true;
  });

  const margin = (p: Product) => {
    const cost = (p as any).supplierCostCents || 0;
    if (!cost) return '—';
    return `${Math.round(((p.priceCents - cost) / p.priceCents) * 100)}%`;
  };

  const startEdit = (p: Product) => {
    setEditing({ ...p });
    setShowForm(true);
  };

  const startNew = () => {
    setEditing({ ...empty, id: `ae-${Date.now()}` });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setShowForm(false);
      setEditing(null);
      await fetchProducts();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Supprimer le produit ${id} ?`)) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    await fetchProducts();
  };

  const formatEur = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{products.length} produits dans le catalogue OnePeace</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          + Ajouter un produit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CATEGORIES.filter(c => products.some(p => p.category === c)).map(cat => (
          <div key={cat} className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase text-gray-500">{cat}</p>
            <p className="text-2xl font-bold text-gray-900">{products.filter(p => p.category === cat).length}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Product table */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Chargement...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Image</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Produit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Catégorie</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Prix</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Coût</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Marge</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Stock</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {p.imageUrls[0] ? (
                      <img src={p.imageUrls[0]} alt="" className="h-12 w-12 rounded-lg object-contain bg-gray-100" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">N/A</div>
                    )}
                  </td>
                  <td className="max-w-[250px] px-4 py-3">
                    <p className="truncate font-medium text-gray-900">{p.name}</p>
                    <p className="truncate text-xs text-gray-400">{p.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatEur(p.priceCents)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">{formatEur((p as any).supplierCostCents || 0)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">{margin(p)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.inStock ? 'bg-green-500' : 'bg-red-500'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(p)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                      {(p as any).sourceUrl && (
                        <a href={(p as any).sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">AE</a>
                      )}
                      <button onClick={() => handleDelete(p.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              {editing.id.startsWith('ae-') && editing.name ? 'Modifier le produit' : 'Nouveau produit'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Nom</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
                <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Catégorie</label>
                <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Source</label>
                <select value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="aliexpress">AliExpress</option>
                  <option value="cj">CJ Dropshipping</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Prix de vente (EUR)</label>
                <input type="number" step="0.01" value={(editing.priceCents / 100).toFixed(2)} onChange={e => setEditing({ ...editing, priceCents: Math.round(parseFloat(e.target.value) * 100) })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Coût fournisseur (EUR)</label>
                <input type="number" step="0.01" value={(editing.supplierCostCents / 100).toFixed(2)} onChange={e => setEditing({ ...editing, supplierCostCents: Math.round(parseFloat(e.target.value) * 100) })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Image URL</label>
                <input value={editing.imageUrls[0] || ''} onChange={e => setEditing({ ...editing, imageUrls: [e.target.value] })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://ae01.alicdn.com/kf/..." />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">URL source fournisseur</label>
                <input value={editing.sourceUrl} onChange={e => setEditing({ ...editing, sourceUrl: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="https://www.aliexpress.com/item/..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.inStock} onChange={e => setEditing({ ...editing, inStock: e.target.checked })} id="instock" />
                <label htmlFor="instock" className="text-sm text-gray-700">En stock</label>
              </div>
              {editing.imageUrls[0] && (
                <div className="flex justify-end">
                  <img src={editing.imageUrls[0]} alt="preview" className="h-24 w-24 rounded-lg border object-contain bg-gray-50" />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saveStatus === 'saving'} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'saved' ? 'Sauvegardé !' : 'Sauvegarder'}
              </button>
            </div>
            {saveStatus === 'error' && <p className="mt-2 text-sm text-red-600">Erreur de sauvegarde. L&apos;API admin products n&apos;est pas encore connectée au storefront.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
