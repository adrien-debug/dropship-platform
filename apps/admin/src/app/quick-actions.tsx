'use client';

import { useState } from 'react';

const QUICK_ACTIONS = [
  {
    id: 'new-shop',
    label: 'Creer une boutique',
    icon: '🚀',
    description: 'Wizard complet : niche → design → deploy',
    href: '/sites/new',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    id: 'pipeline',
    label: 'Pipeline A-Z',
    icon: '🤖',
    description: '2 mots-cles → site live automatique',
    href: '/agents',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
  {
    id: 'trending',
    label: 'Produits tendance',
    icon: '🔥',
    description: 'Decouvrir les produits du moment',
    href: '/discover',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
  },
  {
    id: 'catalogs',
    label: 'Catalogues',
    icon: '📦',
    description: 'Gerer les produits et fournisseurs',
    href: '/catalogs',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: '📣',
    description: 'Google Ads / Meta Ads',
    href: '/marketing',
    color: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
  },
  {
    id: 'health-check',
    label: 'Sante services',
    icon: '💚',
    description: 'GPU, Medusa, Storefronts',
    href: '/gpu',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  },
];

const NICHE_SHORTCUTS = [
  { label: 'Cosmetique', keyword: 'cosmetics beauty skincare' },
  { label: 'Figurines', keyword: 'anime figurine collectible' },
  { label: 'Tech & Gadgets', keyword: 'electronics gadgets tech' },
  { label: 'Mode', keyword: 'fashion clothing streetwear' },
  { label: 'Maison', keyword: 'home decor kitchen' },
  { label: 'Sport', keyword: 'fitness sport outdoor' },
  { label: 'Bijoux', keyword: 'jewelry accessories watches' },
  { label: 'Enfants', keyword: 'kids toys baby' },
  { label: 'Auto & Moto', keyword: 'car accessories automotive' },
  { label: 'Animaux', keyword: 'pets dog cat accessories' },
];

export function QuickActions() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actions rapides</h3>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit, une niche..."
            className="w-72 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={e => {
              if (e.key === 'Enter' && search.trim()) {
                window.location.href = `/discover?q=${encodeURIComponent(search.trim())}`;
              }
            }}
          />
          {search && (
            <button
              onClick={() => {
                window.location.href = `/discover?q=${encodeURIComponent(search.trim())}`;
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-600"
            >
              Go
            </button>
          )}
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map(action => (
          <a
            key={action.id}
            href={action.href}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${action.color}`}
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-[11px] text-gray-500">{action.description}</span>
          </a>
        ))}
      </div>

      {/* Niche shortcuts */}
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm text-gray-500">Niches :</span>
        {NICHE_SHORTCUTS.map(niche => (
          <a
            key={niche.keyword}
            href={`/discover?q=${encodeURIComponent(niche.keyword)}`}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {niche.label}
          </a>
        ))}
      </div>
    </div>
  );
}
