'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price_cents: '',
    cost_cents: '',
    category: '',
    supplier: 'aliexpress',
    supplier_url: '',
    image_urls: '',
    in_stock: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const imageUrls = formData.image_urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const payload = {
        ...formData,
        price_cents: parseInt(formData.price_cents) || 0,
        cost_cents: parseInt(formData.cost_cents) || 0,
        image_urls: imageUrls,
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add product');
      }

      router.push('/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ajouter un produit</h1>
        <p className="text-gray-600 mt-1">Remplis les infos depuis AliExpress ou CJ Dropshipping</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border">
        <div>
          <label className="block text-sm font-medium mb-2">
            Titre du produit <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Kojic Acid Serum - Anti-Dark Spots"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Description complète du produit..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Prix de vente (centimes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="price_cents"
              value={formData.price_cents}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="2990 (= 29.90€)"
            />
            {formData.price_cents && (
              <p className="text-sm text-gray-500 mt-1">
                = {(parseInt(formData.price_cents) / 100).toFixed(2)}€
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Coût fournisseur (centimes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="cost_cents"
              value={formData.cost_cents}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="1200 (= 12.00€)"
            />
            {formData.cost_cents && (
              <p className="text-sm text-gray-500 mt-1">
                = {(parseInt(formData.cost_cents) / 100).toFixed(2)}€
              </p>
            )}
          </div>
        </div>

        {formData.price_cents && formData.cost_cents && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm font-medium text-green-800">
              Marge: {((parseInt(formData.price_cents) - parseInt(formData.cost_cents)) / 100).toFixed(2)}€
              ({(((parseInt(formData.price_cents) - parseInt(formData.cost_cents)) / parseInt(formData.price_cents)) * 100).toFixed(0)}%)
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner...</option>
              <option value="beauty">Beauty / Skincare</option>
              <option value="wellness">Wellness / Santé</option>
              <option value="home">Maison</option>
              <option value="tech">Tech / Gadgets</option>
              <option value="pet">Pet Products</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Fournisseur
            </label>
            <select
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="aliexpress">AliExpress</option>
              <option value="cj">CJ Dropshipping</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            URL fournisseur
          </label>
          <input
            type="url"
            name="supplier_url"
            value={formData.supplier_url}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.aliexpress.com/item/..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            URLs des images (une par ligne) <span className="text-red-500">*</span>
          </label>
          <textarea
            name="image_urls"
            value={formData.image_urls}
            onChange={handleChange}
            required
            rows={4}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="https://ae01.alicdn.com/...jpg&#10;https://ae01.alicdn.com/...jpg"
          />
          <p className="text-sm text-gray-500 mt-1">
            {formData.image_urls.split('\n').filter(u => u.trim()).length} image(s)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="in_stock"
            checked={formData.in_stock}
            onChange={handleChange}
            className="w-4 h-4"
          />
          <label className="text-sm font-medium">En stock</label>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ajout...' : 'Ajouter le produit'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/products')}
            className="px-6 py-2 border rounded hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
