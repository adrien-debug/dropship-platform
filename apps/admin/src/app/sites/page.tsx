'use client';

import { useEffect, useState } from 'react';

interface Site {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain?: string;
  medusa_sales_channel_id?: string;
  theme?: { design_system?: string };
  config?: { port?: number; publishable_key?: string; site_content?: Record<string, unknown> };
  created_at?: string;
}

const GPU2 = '100.110.74.114';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.json())
      .then(d => setSites(d.sites ?? []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sites</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
        >
          + New Site
        </button>
      </div>

      {showCreate && <CreateSiteForm onCreated={(site) => { setSites(prev => [site as Site, ...prev]); setShowCreate(false); }} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Sites" value={sites.length} />
        <StatCard label="Live" value={sites.filter(s => s.status === 'live').length} color="text-green-600" />
        <StatCard label="Design Systems" value={new Set(sites.map(s => s.theme?.design_system).filter(Boolean)).size} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p className="text-lg">No sites yet</p>
          <p className="mt-1 text-sm">Create your first dropshipping site or run the A-Z pipeline</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map(site => {
            const port = site.config?.port;
            const url = port ? `http://${GPU2}:${port}` : null;
            const ds = site.theme?.design_system;

            return (
              <a key={site.id} href={`/sites/${site.id}`} className="block rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{site.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    site.status === 'live' ? 'bg-green-100 text-green-700' :
                    site.status === 'deploying' ? 'bg-yellow-100 text-yellow-700' :
                    site.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {site.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{site.slug}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  {ds && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{ds}</span>}
                  {port && <span>:{port}</span>}
                  {site.created_at && <span className="ml-auto">{new Date(site.created_at).toLocaleDateString()}</span>}
                </div>
                {url && site.status === 'live' && (
                  <div className="mt-2">
                    <span
                      onClick={e => { e.preventDefault(); window.open(url, '_blank'); }}
                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      {url}
                    </span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? ''}`}>{value}</p>
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
          <label className="block text-sm font-medium text-gray-700">Site Name</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="My Watch Store"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Slug</label>
          <input
            type="text" value={slug} onChange={e => setSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="my-watch-store"
          />
        </div>
      </div>
      <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Site'}
      </button>
    </form>
  );
}
