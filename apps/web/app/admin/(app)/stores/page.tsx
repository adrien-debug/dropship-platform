import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatCard, StatusPill, type Tone } from '@/app/admin/_components/AdminUI';
import { StoreAvatar, ButtonLink } from '@/components/ui';
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
  if (s.status === 'creating') return { tone: 'neutral', label: 'Création en cours' };
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
    <div className="flex flex-col flex-1 space-y-4">
      <PageHeader
        kicker="Production · Agent IA"
        title={
          <>
            Stores <em className="italic text-zinc-400">dropshipping</em>
          </>
        }
        lede="L’agent recherche les produits, enrichit les fiches puis publie le store Medusa complet. Mono-produit pour une landing DTC, collection pour un catalogue."
        actions={
          <ButtonLink
            href="/admin/stores/new"
            variant="primary"
            size="md"
            leading={<span aria-hidden className="text-base leading-none">+</span>}
          >
            Nouveau store
          </ButtonLink>
        }
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="En ligne" value={String(active.length)} tone={active.length > 0 ? 'emerald' : 'neutral'} />
        <StatCard label="En création" value={String(creating.length)} tone="neutral" />
        <StatCard label="En erreur" value={String(failed.length)} tone="neutral" />
        <StatCard label="Produits publiés" value={String(totalProducts)} hint="Cumul stores actifs" />
      </section>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-5 flex-1 min-h-0">
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
      className="text-sm text-zinc-600 hover:text-zinc-900 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
    >
      {label}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-20 text-center bg-white">
      <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Premier pas</p>
      <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-admin-text">
        Lance ton <em className="not-italic text-admin-text-muted font-light">premier store</em>.
      </h3>
      <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
        L’agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit.
      </p>
      <ButtonLink href="/admin/stores/new" variant="primary" size="lg" className="mt-8 shadow-cta">
        Créer un store
      </ButtonLink>
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
      <div className={`flex flex-col gap-1.5 ${dim ? 'opacity-70' : ''}`}>
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

  return (
    <article className="group relative bg-admin-bg flex items-center gap-3 border border-admin-border rounded-admin-md shadow-admin-card transition-colors duration-150 hover:border-admin-border-strong hover:bg-admin-bg-subtle px-3 py-2">
      {/* Avatar — compact 32px comme la liste du dashboard */}
      <div className="relative w-8 h-8 shrink-0 rounded-md overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : (
          <StoreAvatar slug={store.slug} name={store.name} size={32} className="rounded-none w-full h-full" />
        )}
      </div>

      {/* Nom + slug — pile de 2 lignes compactes */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-[13px] font-medium text-admin-text truncate leading-tight">{store.name}</h3>
          <span className="text-[10px] text-admin-text-faint uppercase tracking-wide truncate shrink-0">
            {store.niche}
          </span>
        </div>
        <p className="text-[11px] text-admin-text-faint truncate tabular-nums leading-tight mt-0.5">
          /shop/{store.slug}
        </p>
      </div>

      {/* Statut + produits */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 min-w-[100px]">
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
        <span className="text-[11px] text-admin-text-faint tabular-nums">
          {store.product_count} produit{store.product_count > 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <ButtonLink href={`/admin/stores/${store.id}`} variant="primary" size="sm">
          Gérer
        </ButtonLink>
        {store.status === 'active' && (
          <Link
            href={`/shop/${store.slug}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Ouvrir la boutique"
            title="Ouvrir la boutique"
            className="inline-flex items-center justify-center w-7 h-7 rounded-admin-md border border-admin-border hover:bg-admin-bg-subtle hover:border-admin-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-border-strong focus-visible:ring-offset-1 transition-colors text-admin-text-muted"
          >
            <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
        <StoreActions storeId={store.id} storeName={store.name} compact />
      </div>
    </article>
  );
}
