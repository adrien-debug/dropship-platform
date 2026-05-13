import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatCard, StatusPill, type Tone } from '../../_components/AdminUI';
import { StoreLogo } from '@/components/ui';
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
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
}

function pickStoreCover(s: StoreRow): string | null {
  if (s.hero_image_url) return s.hero_image_url;
  const lifestyles = Array.isArray(s.lifestyle_images)
    ? (s.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];
  if (lifestyles[0]) return lifestyles[0];
  if (s.cutout_image_url) return s.cutout_image_url;
  return null;
}

function statusOf(s: StoreRow): { tone: Tone; label: string } {
  if (s.status === 'active') return { tone: 'emerald', label: 'En ligne' };
  if (s.status === 'creating') return { tone: 'amber', label: 'Création en cours' };
  return { tone: 'neutral', label: 'Erreur' };
}

/**
 * Server-side pagination for the stores list.
 * Default: page 1, 24 stores per page (nice grid layout: 3×8, 2×12, etc.).
 */
export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = 24;
  const offset = (page - 1) * pageSize;

  const db = getDbRead();

  const countRes = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM dropship_stores`,
  );
  const total = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const { rows } = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, error_message, created_at,
            hero_image_url, cutout_image_url, lifestyle_images
     FROM dropship_stores ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset],
  );

  const active = rows.filter((s) => s.status === 'active');
  const creating = rows.filter((s) => s.status === 'creating');
  const failed = rows.filter((s) => s.status !== 'active' && s.status !== 'creating');
  const totalProducts = active.reduce((acc, s) => acc + (s.product_count || 0), 0);

  return (
    <div className="flex flex-col flex-1 space-y-6">
      <PageHeader
        kicker="Production · Agent IA"
        title={
          <>
            Stores <em className="italic text-zinc-400">dropshipping</em>
          </>
        }
        lede="L’agent recherche les produits, enrichit les fiches puis publie le store Medusa complet. Mono-produit pour une landing DTC, collection pour un catalogue."
        actions={
          <Link
            href="/admin/stores/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span aria-hidden className="text-base leading-none">+</span>
            Nouveau store
          </Link>
        }
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="En ligne" value={String(active.length)} tone={active.length > 0 ? 'emerald' : 'neutral'} />
        <StatCard label="En création" value={String(creating.length)} tone={creating.length > 0 ? 'amber' : 'neutral'} />
        <StatCard label="En erreur" value={String(failed.length)} tone="neutral" />
        <StatCard label="Produits publiés" value={String(totalProducts)} hint="Cumul stores actifs" />
      </section>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6 flex-1 min-h-0">
          {active.length > 0 && (
            <StoreGroup kicker={`Stores actifs · ${active.length}`} stores={active} />
          )}
          {creating.length > 0 && (
            <StoreGroup kicker={`En cours · ${creating.length}`} stores={creating} />
          )}
          {failed.length > 0 && (
            <StoreGroup kicker={`À nettoyer · ${failed.length}`} stores={failed} dim />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <PaginationLink page={page - 1} disabled={page <= 1} label="← Précédent" />
              <span className="text-sm text-zinc-400 tabular-nums px-3">
                Page {page} / {totalPages}
              </span>
              <PaginationLink page={page + 1} disabled={page >= totalPages} label="Suivant →" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="text-sm text-zinc-300 px-3 py-1.5 rounded-lg cursor-not-allowed">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/stores?page=${page}`}
      className="text-sm text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors"
    >
      {label}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-zinc-200 rounded-2xl px-6 py-20 text-center bg-white">
      <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Premier pas</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
        Lance ton <em className="italic text-zinc-500">premier store</em>.
      </h3>
      <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
        L’agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit.
      </p>
      <Link
        href="/admin/stores/new"
        className="mt-8 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-cta"
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
      <div className={`flex flex-col gap-2 ${dim ? 'opacity-70' : ''}`}>
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
    </section>
  );
}

function StoreCard({ store }: { store: StoreRow }) {
  const s = statusOf(store);
  const cover = pickStoreCover(store);
  const primary = store.primary_color || '#0f172a';
  const accent = store.accent_color || primary;

  return (
    <article className="group relative bg-white rounded-xl overflow-hidden flex items-center gap-4 border border-zinc-200 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.12)] p-3">
      {/* ── Cover thumbnail à gauche */}
      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 80% 0%, ${accent}88 0%, transparent 55%), linear-gradient(155deg, ${primary} 0%, #0a0a0a 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white drop-shadow">
            <StoreLogo emoji={store.logo_emoji} size={28} strokeWidth={1.5} />
          </span>
        </div>
      </div>

      {/* ── Détails au centre */}
      <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
        {/* Nom + niche */}
        <div className="col-span-4 min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 truncate">{store.name}</h3>
          <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-0.5 truncate">{store.niche}</p>
        </div>

        {/* Tagline */}
        <div className="col-span-4 min-w-0">
          {store.tagline ? (
            <p className="text-xs text-zinc-500 leading-snug line-clamp-2">« {store.tagline} »</p>
          ) : (
            <p className="text-xs text-zinc-300 italic">Sans tagline</p>
          )}
        </div>

        {/* Statut + produits */}
        <div className="col-span-2 flex flex-col items-start gap-1">
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          <span className="text-[11px] text-zinc-400 tabular-nums">
            {store.product_count} produit{store.product_count > 1 ? 's' : ''}
          </span>
        </div>

        {/* Slug */}
        <div className="col-span-2 min-w-0">
          <p className="text-[10px] font-mono text-zinc-400 truncate">/shop/{store.slug}</p>
          {store.error_message && store.status !== 'active' && store.status !== 'creating' && (
            <p className="text-[10px] text-zinc-500 truncate mt-0.5" title={store.error_message}>
              {store.error_message}
            </p>
          )}
        </div>
      </div>

      {/* ── Actions à droite */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={`/admin/stores/${store.id}`}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium text-white"
        >
          Gérer
        </Link>
        {store.status === 'active' && (
          <Link
            href={`/shop/${store.slug}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Ouvrir la boutique"
            title="Ouvrir la boutique"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-zinc-200 hover:bg-indigo-50 hover:border-zinc-300 transition-colors text-zinc-500"
          >
            <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
        <StoreActions storeId={store.id} storeName={store.name} compact />
      </div>
    </article>
  );
}
