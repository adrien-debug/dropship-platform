import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatusPill, type Tone } from '@/app/admin/_components/AdminUI';
import { StoreAvatar, ButtonLink } from '@/components/ui';
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';
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
            Stores <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>dropshipping</em>
          </>
        }
        lede="L'agent recherche les produits, enrichit les fiches puis publie le store Medusa complet. Mono-produit pour une landing DTC, collection pour un catalogue."
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

      <KpiGrid>
        <KpiCard label="En ligne" value={String(active.length)} accent={active.length > 0} />
        <KpiCard label="En création" value={String(creating.length)} />
        <KpiCard label="En erreur" value={String(failed.length)} />
        <KpiCard label="Produits publiés" value={String(totalProducts)} />
      </KpiGrid>

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
              <span style={{ fontSize: 13, color: 'var(--ct-text-faint)', fontVariantNumeric: 'tabular-nums', padding: '0 12px' }}>
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
      <span style={{ fontSize: 13, color: 'var(--ct-text-faint)', padding: '6px 12px', borderRadius: 8, cursor: 'not-allowed' }}>
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/stores?page=${page}`}
      style={{ fontSize: 13, color: 'var(--ct-text-body)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--ct-border)', transition: 'background var(--ct-dur-base)' }}
    >
      {label}
    </Link>
  );
}

function EmptyState() {
  return (
    <div style={{
      border: '1px dashed var(--ct-border-strong)',
      borderRadius: 12, padding: '80px 24px',
      textAlign: 'center',
      background: 'var(--ct-surface-1)',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)' }}>
        Premier pas
      </p>
      <h3 className="ct-kpi-value" style={{ marginTop: 8, minWidth: 0 }}>
        Lance ton <em style={{ fontStyle: 'normal', color: 'var(--ct-text-muted)', fontWeight: 300 }}>premier store</em>.
      </h3>
      <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ct-text-muted)', maxWidth: 400, margin: '12px auto 0', lineHeight: 1.6 }}>
        L’agent IA recherche les produits, génère les visuels, écrit les fiches et publie le store. Une niche suffit.
      </p>
      <div style={{ marginTop: 32 }}>
        <ButtonLink href="/admin/stores/new" variant="primary" size="lg">
          Créer un store
        </ButtonLink>
      </div>
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
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)', marginBottom: 12 }}>
        {kicker}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: dim ? 0.7 : 1 }}>
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
    <article style={{
      position: 'relative',
      background: 'var(--ct-surface-1)',
      display: 'flex', alignItems: 'center', gap: 12,
      border: '1px solid var(--ct-border)',
      borderRadius: 8,
      padding: '8px 12px',
      transition: 'border-color var(--ct-dur-base)',
    }}>
      {/* Avatar */}
      <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
        {cover ? (
          <Image src={cover} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} />
        ) : (
          <StoreAvatar slug={store.slug} name={store.name} size={32} className="rounded-none w-full h-full" />
        )}
      </div>

      {/* Nom + slug */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {store.name}
          </h3>
          <span style={{ fontSize: 10, color: 'var(--ct-text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>
            {store.niche}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ct-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          /shop/{store.slug}
        </p>
      </div>

      {/* Statut + produits */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0, minWidth: 100 }}>
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
        <span style={{ fontSize: 11, color: 'var(--ct-text-faint)', fontVariantNumeric: 'tabular-nums' }}>
          {store.product_count} produit{store.product_count > 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              borderRadius: 6, border: '1px solid var(--ct-border)',
              color: 'var(--ct-text-muted)', textDecoration: 'none',
              transition: 'background var(--ct-dur-base)',
            }}
          >
            <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
        <StoreActions storeId={store.id} storeName={store.name} compact />
      </div>
    </article>
  );
}
