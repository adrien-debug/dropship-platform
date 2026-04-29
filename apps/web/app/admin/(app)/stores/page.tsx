import Link from 'next/link';
import { getDb } from '@/lib/db';
import { StoreActions } from './StoreActions';

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
  error_message: string | null;
}

export default async function StoresPage() {
  const db = getDb();
  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at
     FROM dropship_stores ORDER BY created_at DESC LIMIT 100`,
  );

  const active = rows.filter(s => s.status === 'active');
  const failed = rows.filter(s => s.status !== 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stores dropshipping</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {active.length} actif(s) · {failed.length} en erreur/vide(s)
          </p>
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
            L&apos;agent IA génère des produits, les enrichit et crée un store complet automatiquement.
          </p>
          <Link
            href="/admin/stores/new"
            className="bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            Créer mon premier store
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Stores actifs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map(store => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">À nettoyer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {failed.map(store => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoreCard({ store }: { store: StoreRow }) {
  const statusColor = store.status === 'active'
    ? 'bg-green-100 text-green-800'
    : store.status === 'creating'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-800';

  const statusIcon = store.status === 'active' ? '✅' : store.status === 'creating' ? '⏳' : '❌';

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div
        className="h-14 flex items-center px-4 gap-3"
        style={{ backgroundColor: store.primary_color || '#111827' }}
      >
        <span className="text-2xl">{store.logo_emoji || '🛍️'}</span>
        <div className="text-white min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{store.name}</div>
          <div className="text-xs opacity-60 truncate">{store.niche}</div>
        </div>
      </div>

      <div className="p-4 bg-white">
        {store.tagline && (
          <p className="text-xs text-zinc-500 italic mb-3 line-clamp-1">&quot;{store.tagline}&quot;</p>
        )}
        {store.error_message && store.status !== 'active' && (
          <p className="text-xs text-red-600 mb-2 line-clamp-2">{store.error_message}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
            {statusIcon} {store.status}
          </span>
          <span className="text-xs text-zinc-400">{store.product_count} produits</span>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/admin/stores/${store.id}`}
            className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors font-medium"
          >
            Détails
          </Link>
          {store.status === 'active' && (
            <Link
              href={`/shop/${store.slug}`}
              target="_blank"
              className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors font-medium"
            >
              Voir →
            </Link>
          )}
          <StoreActions storeId={store.id} storeName={store.name} />
        </div>

        <p className="text-kicker text-zinc-300 mt-2 truncate">/shop/{store.slug}</p>
      </div>
    </div>
  );
}
