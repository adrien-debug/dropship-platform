'use client';

import { useEffect, useState } from 'react';
import type { SiteConfig } from '@dropship/core';

export default function SitesPage() {
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(d => { setSites(d.sites ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sites</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          + Nouveau site
        </button>
      </div>

      {showCreate && <CreateSiteForm onCreated={(site) => { setSites(prev => [...prev, site as SiteConfig]); setShowCreate(false); }} />}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p className="text-lg">Aucun site</p>
          <p className="mt-1 text-sm">Creez votre premier site dropshipping</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map(site => (
            <a key={site.id} href={`/sites/${site.id}`} className="block rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{site.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  site.status === 'live' ? 'bg-green-100 text-green-700' :
                  site.status === 'deploying' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {site.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{site.domain ?? site.slug}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSiteForm({ onCreated }: { onCreated: (site: unknown) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.site) onCreated(data.site);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nom du site</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="One Piece Shop"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Slug</label>
          <input
            type="text" value={slug} onChange={e => setSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="onepiece-shop"
          />
        </div>
      </div>
      <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Creation...' : 'Creer le site'}
      </button>
    </form>
  );
}
