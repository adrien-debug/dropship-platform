import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  created_at: string;
}

export default async function StoresPage() {
  const db = getDb();
  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, created_at
     FROM dropship_stores ORDER BY created_at DESC LIMIT 100`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stores dropshipping</h2>
          <p className="text-sm text-zinc-500 mt-1">{rows.length} store(s) créé(s)</p>
        </div>
        <Link
          href="/admin/stores/new"
          className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          + Créer un store avec l&apos;agent IA
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-zinc-700 mb-2">Aucun store créé</h3>
          <p className="text-sm text-zinc-500 mb-6">
            L&apos;agent IA va rechercher des produits, les enrichir et créer un store complet automatiquement.
          </p>
          <Link
            href="/admin/stores/new"
            className="bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Créer mon premier store
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((store) => (
            <div key={store.id} className="border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div
                className="h-16 flex items-center px-5 gap-3"
                style={{ backgroundColor: store.primary_color || '#111827' }}
              >
                <span className="text-3xl">{store.logo_emoji || '🛍️'}</span>
                <div className="text-white">
                  <div className="font-bold leading-tight">{store.name}</div>
                  <div className="text-xs opacity-70">{store.niche}</div>
                </div>
              </div>
              <div className="p-4 bg-white">
                {store.tagline && (
                  <p className="text-sm text-zinc-600 italic mb-3">&quot;{store.tagline}&quot;</p>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      store.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : store.status === 'creating'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {store.status === 'active' ? '✅' : store.status === 'creating' ? '⏳' : '❌'}
                    {store.status}
                  </span>
                  <span className="text-sm text-zinc-500">{store.product_count} produits</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/shop/${store.slug}`}
                    target="_blank"
                    className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    Voir le store →
                  </Link>
                  <span className="flex-1 text-center text-xs py-2 rounded-lg bg-zinc-50 text-zinc-400 truncate px-2">
                    /shop/{store.slug}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
