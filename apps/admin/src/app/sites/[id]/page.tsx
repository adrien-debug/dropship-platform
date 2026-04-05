'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SiteData {
  id: string;
  name: string;
  slug: string;
  status: string;
  medusa_sales_channel_id?: string;
  theme?: { design_system?: string };
  config?: {
    port?: number;
    publishable_key?: string;
    site_content?: {
      brand?: { name: string; tagline: string; tone_of_voice?: string };
      hero_title?: string;
      hero_subtitle?: string;
      hero_cta?: string;
      about_html?: string;
      seo_title?: string;
      seo_description?: string;
      seo_keywords?: string[];
    };
  };
  created_at?: string;
}

const GPU2 = '100.110.74.114';

export default function SiteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/sites/${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(d => setSite(d.site))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>;
  if (error || !site) return <div className="rounded-xl border-2 border-dashed p-12 text-center text-red-500">Site not found: {error}</div>;

  const port = site.config?.port;
  const siteUrl = port ? `http://${GPU2}:${port}` : null;
  const sc = site.config?.site_content;
  const ds = site.theme?.design_system ?? 'unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{site.name}</h2>
          <p className="text-sm text-gray-500">{site.slug} · {ds} design</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            site.status === 'live' ? 'bg-green-100 text-green-700' :
            site.status === 'deploying' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>{site.status}</span>
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Open Site
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Port" value={port ? String(port) : '—'} />
        <InfoCard label="Design System" value={ds} />
        <InfoCard label="Sales Channel" value={site.medusa_sales_channel_id?.slice(0, 12) ?? '—'} />
      </div>

      {sc?.brand && (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Brand</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><span className="text-sm text-gray-500">Name:</span> <span className="font-medium">{sc.brand.name}</span></div>
            <div><span className="text-sm text-gray-500">Tagline:</span> <span className="font-medium">{sc.brand.tagline}</span></div>
            {sc.brand.tone_of_voice && <div><span className="text-sm text-gray-500">Tone:</span> {sc.brand.tone_of_voice}</div>}
          </div>
        </section>
      )}

      {(sc?.hero_title || sc?.hero_subtitle) && (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Hero Section</h3>
          <div className="space-y-1">
            {sc.hero_title && <p><span className="text-sm text-gray-500">Title:</span> <span className="font-medium">{sc.hero_title}</span></p>}
            {sc.hero_subtitle && <p><span className="text-sm text-gray-500">Subtitle:</span> {sc.hero_subtitle}</p>}
            {sc.hero_cta && <p><span className="text-sm text-gray-500">CTA:</span> {sc.hero_cta}</p>}
          </div>
        </section>
      )}

      {(sc?.seo_title || sc?.seo_keywords) && (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">SEO</h3>
          <div className="space-y-1">
            {sc.seo_title && <p><span className="text-sm text-gray-500">Title:</span> {sc.seo_title}</p>}
            {sc.seo_description && <p><span className="text-sm text-gray-500">Description:</span> {sc.seo_description}</p>}
            {sc.seo_keywords && sc.seo_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {sc.seo_keywords.map((kw, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{kw}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Details</h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-gray-500">ID:</span> <code className="text-xs">{site.id}</code></div>
          <div><span className="text-gray-500">Created:</span> {site.created_at ? new Date(site.created_at).toLocaleString() : '—'}</div>
          {site.config?.publishable_key && (
            <div className="sm:col-span-2"><span className="text-gray-500">Publishable Key:</span> <code className="text-xs">{site.config.publishable_key.slice(0, 20)}...</code></div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
