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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  const cloneSite = async (id: string, name: string) => {
    setCloning(id);
    try {
      const res = await fetch('/api/sites/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: id, new_name: `${name} (copy)` }),
      });
      const data = await res.json();
      if (data.site) {
        setSites(prev => [data.site as Site, ...prev]);
      }
    } catch { /* ignore */ }
    setCloning(null);
  };

  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.json())
      .then(d => setSites(d.sites ?? []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  const deleteSite = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSites(prev => prev.filter(s => s.id !== id));
      }
    } catch { /* ignore */ }
    setDeleting(null);
  };

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
              <div key={site.id} className="relative rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="absolute right-3 top-3 flex gap-1">
                  <button
                    onClick={() => cloneSite(site.id, site.name)}
                    disabled={cloning === site.id}
                    className="rounded-lg p-1.5 text-gray-300 transition hover:bg-blue-50 hover:text-blue-500 disabled:opacity-50"
                    title="Dupliquer ce site"
                  >
                    {cloning === site.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5" /></svg>
                    )}
                  </button>
                  <button
                    onClick={() => deleteSite(site.id, site.name)}
                    disabled={deleting === site.id}
                    className="rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    title="Delete site"
                  >
                  {deleting === site.id ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  )}
                </button>
                </div>
                <a href={`/sites/${site.id}`} className="block">
                  <div className="flex items-center justify-between pr-8">
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
              </div>
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
