import Link from 'next/link';
import { getDb } from '@/lib/db';
import { PageHeader, StatCard, StatusPill, type Tone } from '../../_components/AdminUI';
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

function statusOf(s: StoreRow): { tone: Tone; label: string } {
  if (s.status === 'active') return { tone: 'emerald', label: 'En ligne' };
  if (s.status === 'creating') return { tone: 'amber', label: 'Création en cours' };
  return { tone: 'red', label: 'Erreur' };
}

export default async function StoresPage() {
  const db = getDb();
  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at
     FROM dropship_stores ORDER BY created_at DESC LIMIT 100`,
  );

  const active = rows.filter((s) => s.status === 'active');
  const creating = rows.filter((s) => s.status === 'creating');
  const failed = rows.filter((s) => s.status !== 'active' && s.status !== 'creating');
  const totalProducts = active.reduce((acc, s) => acc + (s.product_count || 0), 0);

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Production · Agent IA"
        title={
          <>
            Stores <em className="italic text-zinc-500">dropshipping</em>
          </>
        }
        lede="L’agent recherche les produits, enrichit les fiches puis publie le store Medusa complet. Mono-produit pour une landing DTC, collection pour un catalogue."
        actions={
          <Link
            href="/admin/stores/new"
            className="inline-flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors shadow-cta"
          >
            <span aria-hidden className="text-base leading-none">+</span>
            Nouveau store
          </Link>
        }
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="En ligne" value={String(active.length)} tone={active.length > 0 ? 'emerald' : 'neutral'} />
        <StatCard label="En création" value={String(creating.length)} tone={creating.length > 0 ? 'amber' : 'neutral'} />
        <StatCard label="En erreur" value={String(failed.length)} tone={failed.length > 0 ? 'red' : 'neutral'} />
        <StatCard label="Produits publiés" value={String(totalProducts)} hint="Cumul stores actifs" />
      </section>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <StoreGroup kicker={`Stores actifs · ${active.length}`} stores={active} />
          )}
          {creating.length > 0 && (
            <StoreGroup kicker={`En cours · ${creating.length}`} stores={creating} />
          )}
          {failed.length > 0 && (
            <StoreGroup kicker={`À nettoyer · ${failed.length}`} stores={failed} dim />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-zinc-200 rounded-2xl px-6 py-20 text-center bg-white">
      <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Premier pas</p>
      <h3 className="mt-2 text-2xl font-serif text-zinc-900">
        Lance ton <em className="italic text-zinc-500">premier store</em>.
      </h3>
      <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
        L’agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit.
      </p>
      <Link
        href="/admin/stores/new"
        className="mt-8 inline-flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-6 py-3 rounded-lg hover:bg-zinc-800 transition-colors shadow-cta"
      >
        Créer un store
      </Link>
    </div>
  );
}

function StoreGroup({
  kicker,
  stores,
  dim = false,
}: {
  kicker: string;
  stores: StoreRow[];
  dim?: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">{kicker}</p>
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${dim ? 'opacity-70' : ''}`}>
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
    </section>
  );
}

function StoreCard({ store }: { store: StoreRow }) {
  const s = statusOf(store);
  return (
    <article className="group border border-zinc-200 bg-white rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:border-zinc-300 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div
        className="h-14 flex items-center px-4 gap-3"
        style={{ backgroundColor: store.primary_color || '#0f172a' }}
      >
        <span className="text-2xl shrink-0" aria-hidden>{store.logo_emoji || '◆'}</span>
        <div className="text-white min-w-0">
          <div className="font-medium text-sm leading-tight truncate">{store.name}</div>
          <div className="text-xs opacity-60 truncate">{store.niche}</div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {store.tagline && (
          <p className="text-sm font-serif italic text-zinc-500 mb-3 line-clamp-1">
            &laquo;&nbsp;{store.tagline}&nbsp;&raquo;
          </p>
        )}

        {store.error_message && store.status !== 'active' && store.status !== 'creating' && (
          <p className="text-xs text-red-600 mb-3 line-clamp-2 leading-relaxed">{store.error_message}</p>
        )}

        <div className="flex items-center justify-between mb-4 mt-auto">
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          <span className="text-xs text-zinc-400 font-medium">
            {store.product_count} produit{store.product_count > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/admin/stores/${store.id}`}
            className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-colors font-medium text-zinc-700"
          >
            Détails
          </Link>
          {store.status === 'active' && (
            <Link
              href={`/shop/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-colors font-medium text-zinc-700"
            >
              Ouvrir <span aria-hidden>↗</span>
            </Link>
          )}
          <StoreActions storeId={store.id} storeName={store.name} />
        </div>

        <p className="text-kicker font-mono text-zinc-400 mt-3 truncate">/shop/{store.slug}</p>
      </div>
    </article>
  );
}
