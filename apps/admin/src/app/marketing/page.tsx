'use client';

import { useEffect, useState } from 'react';

interface Campaign {
  id: string;
  site_id: string;
  platform: string;
  name: string;
  daily_budget: number | null;
  status: string;
  metrics: Record<string, unknown>;
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => setCampaigns(d.campaigns ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Marketing</h2>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light">
          + Nouvelle campagne
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Google Ads</p>
          <p className="mt-2 text-2xl font-bold">{campaigns.filter(c => c.platform === 'google_ads').length}</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Meta Ads</p>
          <p className="mt-2 text-2xl font-bold">{campaigns.filter(c => c.platform === 'meta').length}</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Budget total/jour</p>
          <p className="mt-2 text-2xl font-bold">
            {(campaigns.reduce((sum, c) => sum + (c.daily_budget ?? 0), 0) / 100).toFixed(0)} EUR
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
          <p>Aucune campagne marketing. Creez-en une pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm">
              <div>
                <h3 className="font-medium">{c.name}</h3>
                <p className="text-sm text-gray-500">{c.platform} · {c.daily_budget ? `${(c.daily_budget/100).toFixed(0)} EUR/jour` : 'Pas de budget'}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                c.status === 'active' ? 'bg-green-100 text-green-700' :
                c.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
