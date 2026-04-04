import { createClient } from '@/lib/supabase-server';
import { QuickActions } from './quick-actions';
import { ProductSearch } from './product-search';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const [sitesRes, catalogsRes, campaignsRes] = await Promise.all([
    supabase.from('sites').select('*', { count: 'exact' }),
    supabase.from('catalogs').select('*', { count: 'exact' }),
    supabase.from('campaigns').select('*', { count: 'exact' }),
  ]);

  const stats = [
    { label: 'Sites', value: sitesRes.count ?? 0, color: 'bg-blue-500' },
    { label: 'Catalogues', value: catalogsRes.count ?? 0, color: 'bg-green-500' },
    { label: 'Campagnes', value: campaignsRes.count ?? 0, color: 'bg-purple-500' },
    { label: 'Sites live', value: (sitesRes.data ?? []).filter(s => s.status === 'live').length, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            <div className={`mt-3 h-1 w-12 rounded-full ${stat.color}`} />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Product Discovery */}
      <ProductSearch />

      {/* Sites + Syncs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Sites recents</h3>
          {(sitesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">Aucun site</p>
          ) : (sitesRes.data ?? []).slice(0, 5).map(site => (
            <div key={site.id} className="flex items-center justify-between border-b py-3 last:border-0">
              <div>
                <p className="font-medium">{site.name}</p>
                <p className="text-sm text-gray-500">{site.domain ?? site.slug}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                site.status === 'live' ? 'bg-green-100 text-green-700' :
                site.status === 'deploying' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {site.status}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold">Derniers syncs</h3>
          <p className="text-sm text-gray-500">Aucun sync pour le moment</p>
        </div>
      </div>
    </div>
  );
}
