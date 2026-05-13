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
  return { tone: 'red', label: 'Erreur' };
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
    <div className="space-y-10">
      <PageHeader
        kicker="Production · Agent IA"
        title={
          <>
            Stores <em className="italic text-ds-text-muted">dropshipping</em>
          </>
        }
        lede="L’agent recherche les produits, enrichit les fiches puis publie le store Medusa complet. Mono-produit pour une landing DTC, collection pour un catalogue."
        actions={
          <Link
            href="/admin/stores/new"
            className="inline-flex items-center gap-2 bg-[var(--accent-cyan)] text-ds-bg-base text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[var(--accent-blue)] transition-colors"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <PaginationLink page={page - 1} disabled={page <= 1} label="← Précédent" />
              <span className="text-sm text-ds-text-muted tabular-nums px-3">
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
      <span className="text-sm text-ds-text-disabled px-3 py-1.5 rounded-lg cursor-not-allowed">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/stores?page=${page}`}
      className="text-sm text-ds-text-secondary hover:text-ds-text-primary px-3 py-1.5 rounded-lg hover:bg-ds-surface-default transition-colors"
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
        <p className="text-kicker uppercase tracking-label text-ds-text-muted font-medium">{kicker}</p>
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
  const cover = pickStoreCover(store);
  const primary = store.primary_color || '#0f172a';
  const accent = store.accent_color || primary;

  return (
    <article className="group relative bg-ds-surface-subtle rounded-2xl overflow-hidden flex flex-col ring-1 ring-ds-border-subtle transition-all duration-300 hover:ring-ds-border-default hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.40)]">
      {/* ── COVER : hero image with gradient overlay, or rich color fallback */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            {/* Deep gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            {/* Brand color tint, multiplied so the cover still breathes through */}
            <div
              className="absolute inset-0 mix-blend-multiply opacity-30"
              style={{ background: `linear-gradient(160deg, ${primary} 0%, transparent 60%)` }}
            />
          </>
        ) : (
          // No-image fallback: layered gradient using the store's brand colors
          // (two stops + soft glow). Beats a flat color band.
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 80% 0%, ${accent}88 0%, transparent 55%), linear-gradient(155deg, ${primary} 0%, #0a0a0a 100%)`,
            }}
          />
        )}

        {/* Status pill — floats top-left over the cover */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm shadow-sm">
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
        </div>

        {/* Product count — top-right */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-sm text-white">
            {store.product_count} produit{store.product_count > 1 ? 's' : ''}
          </span>
        </div>

        {/* Bottom overlay: logo + name + niche, anchored over the gradient */}
        <div className="absolute bottom-0 inset-x-0 p-5 text-white">
          <div className="flex items-end gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shrink-0">
              <StoreLogo emoji={store.logo_emoji} size={20} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold tracking-[-0.02em] leading-tight truncate">{store.name}</h3>
              <p className="text-xs text-white/70 tracking-wide uppercase mt-0.5 truncate">
                {store.niche}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY : tagline + meta + actions */}
      <div className="p-5 flex-1 flex flex-col">
        {store.tagline ? (
          <p className="text-sm text-ds-text-secondary leading-relaxed line-clamp-2 mb-4">
            « {store.tagline} »
          </p>
        ) : (
          <p className="text-sm text-ds-text-muted italic mb-4">Sans tagline</p>
        )}

        {store.error_message && store.status !== 'active' && store.status !== 'creating' && (
          <p className="text-xs text-[var(--danger)] mb-4 line-clamp-2 leading-relaxed bg-[var(--danger-muted)] border border-[var(--danger-muted)] rounded-lg px-3 py-2">
            {store.error_message}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2">
          <Link
            href={`/admin/stores/${store.id}`}
            className="flex-1 text-center text-xs py-2 rounded-lg bg-[var(--accent-cyan)] hover:bg-[var(--accent-blue)] transition-colors font-medium text-ds-bg-base"
          >
            Gérer le store
          </Link>
          {store.status === 'active' && (
            <Link
              href={`/shop/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Ouvrir la boutique"
              title="Ouvrir la boutique"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-ds-border-subtle hover:bg-ds-surface-default hover:border-ds-border-default transition-colors text-ds-text-secondary"
            >
              <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
            </Link>
          )}
          <StoreActions storeId={store.id} storeName={store.name} />
        </div>

        <p className="text-kicker font-mono text-ds-text-muted mt-3 truncate">/shop/{store.slug}</p>
      </div>
    </article>
  );
}
