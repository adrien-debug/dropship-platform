import { createClient } from '@/lib/supabase-server';
import { QuickActions } from './quick-actions';
import { ProductSearch } from './product-search';
import { DashboardLive } from './dashboard-live';

export const dynamic = 'force-dynamic';

interface SiteRow { id: string; name: string; domain?: string; slug?: string; status?: string; created_at?: string; [key: string]: unknown; }
interface SyncRow { id: string; catalog_id?: string; started_at?: string; status?: string; product_count?: number; error?: string; [key: string]: unknown; }
interface CatalogRow { id: string; name: string; supplier?: string; last_sync_at?: string; product_count?: number; [key: string]: unknown; }
interface ProductRow { cost_cents?: number; price_cents?: number; [key: string]: unknown; }

export default async function DashboardPage() {
  let sites: SiteRow[] = [];
  let sitesTotal = 0;
  let catalogsCount = 0;
  let campaignsCount = 0;
  let productsCount = 0;
  let syncs: SyncRow[] = [];
  let catalogs: CatalogRow[] = [];
  let revenue = { totalCost: 0, totalPrice: 0, margin: 0 };

  try {
    const supabase = createClient();
    const [sRes, cRes, campRes, pRes, syncRes, catRes, revenueRes] = await Promise.all([
      supabase.from('sites').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
      supabase.from('catalogs').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(10),
      supabase.from('catalogs').select('id,name,supplier,last_sync_at,product_count').order('last_sync_at', { ascending: false, nullsFirst: false }).limit(10),
      supabase.from('products').select('cost_cents,price_cents').limit(5000),
    ]);

    sites = sRes.data ?? [];
    sitesTotal = sRes.count ?? 0;
    catalogsCount = cRes.count ?? 0;
    campaignsCount = campRes.count ?? 0;
    productsCount = pRes.count ?? 0;
    syncs = syncRes.data ?? [];
    catalogs = catRes.data ?? [];

    const products = (revenueRes.data ?? []) as ProductRow[];
    let totalCost = 0;
    let totalPrice = 0;
    for (const p of products) {
      totalCost += p.cost_cents ?? 0;
      totalPrice += p.price_cents ?? 0;
    }
    revenue = { totalCost: totalCost / 100, totalPrice: totalPrice / 100, margin: (totalPrice - totalCost) / 100 };
  } catch (err) {
    console.error('[dashboard] Supabase error:', err instanceof Error ? err.message : err);
  }

  const liveSites = sites.filter(s => s.status === 'live').length;
  const todaySites = sites.filter(s => {
    if (!s.created_at) return false;
    return new Date(s.created_at).toDateString() === new Date().toDateString();
  }).length;

  const stats = [
    { label: 'Sites total', value: sitesTotal, sub: `${todaySites} aujourd'hui`, color: 'bg-blue-500', icon: '🌐' },
    { label: 'Sites live', value: liveSites, sub: `${sitesTotal - liveSites} en cours`, color: 'bg-emerald-500', icon: '🟢' },
    { label: 'Produits', value: productsCount, sub: `${catalogsCount} catalogues`, color: 'bg-green-500', icon: '🏷️' },
    { label: 'Marge estimee', value: `${revenue.margin.toFixed(0)}€`, sub: `${revenue.totalPrice.toFixed(0)}€ ventes`, color: 'bg-purple-500', icon: '💰' },
    { label: 'Campagnes', value: campaignsCount, sub: 'Google + Meta', color: 'bg-pink-500', icon: '📣' },
    { label: 'Syncs', value: syncs.length, sub: syncs[0]?.started_at ? `Dernier: ${timeAgo(syncs[0].started_at)}` : 'Aucun', color: 'bg-orange-500', icon: '🔄' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <DashboardLive />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stat.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{stat.sub}</p>
            <div className={`mt-2 h-1 w-10 rounded-full ${stat.color}`} />
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Sites recents</h3>
            <a href="/sites" className="text-xs text-blue-600 hover:text-blue-700">Voir tout →</a>
          </div>
          {sites.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun site</p>
          ) : sites.slice(0, 6).map(site => (
            <div key={site.id} className="flex items-center justify-between border-b py-3 last:border-0">
              <div>
                <p className="font-medium">{site.name}</p>
                <p className="text-xs text-gray-400">{site.domain ?? site.slug} {site.created_at ? `· ${timeAgo(site.created_at)}` : ''}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                site.status === 'live' ? 'bg-green-100 text-green-700' :
                site.status === 'deploying' || site.status === 'building' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {String(site.status ?? 'draft')}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Derniers syncs & catalogues</h3>
            <a href="/catalogs" className="text-xs text-blue-600 hover:text-blue-700">Voir tout →</a>
          </div>
          {catalogs.length === 0 && syncs.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun sync</p>
          ) : (
            <div className="space-y-3">
              {catalogs.slice(0, 6).map(cat => (
                <div key={cat.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-gray-400">
                      {cat.supplier ?? 'CJ'} · {cat.product_count ?? 0} produits
                      {cat.last_sync_at ? ` · sync ${timeAgo(cat.last_sync_at)}` : ' · jamais sync'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    cat.last_sync_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {cat.last_sync_at ? 'synced' : 'pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'maintenant';
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}
