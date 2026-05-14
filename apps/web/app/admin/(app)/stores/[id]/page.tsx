import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { StoreAvatar, ButtonLink } from '@/components/ui';
import { StoreActions } from '../StoreActions';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

interface StoreDetailRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  description: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  status: string;
  product_count: number;
  medusa_sales_channel_id: string | null;
  medusa_publishable_key: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  ga4_measurement_id: string | null;
  ga4_api_secret: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
  google_ads_conversion_action: string | null;
  google_merchant_id: string | null;
  template: 'auto' | 'mono' | 'collection-grid' | 'collection-editorial';
  custom_domain: string | null;
}

interface ProductRow {
  id: string;
  supplier: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  supplier_url: string | null;
  medusa_product_id: string | null;
  created_at: string;
}

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDbRead();

  const storeRes = await db.query<StoreDetailRow>(
    `SELECT id, slug, name, niche, tagline, description, logo_emoji, primary_color, accent_color,
            status, product_count, medusa_sales_channel_id, medusa_publishable_key,
            error_message, created_at, updated_at,
            ga4_measurement_id, ga4_api_secret,
            meta_pixel_id, meta_capi_token,
            tiktok_pixel_id, tiktok_events_token, clarity_id,
            google_ads_conversion_action, google_merchant_id,
            template, custom_domain
     FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );

  const store = storeRes.rows[0];
  if (!store) notFound();

  const productsRes = await db.query<ProductRow>(
    `SELECT id, supplier, enriched_title, enriched_description, price_cents, cost_cents,
            image_url, supplier_url, medusa_product_id, created_at
     FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  const products = productsRes.rows;

  const margin = products.length > 0
    ? products.reduce((sum, p) => sum + (p.price_cents - p.cost_cents), 0) / products.length / 100
    : 0;

  const avgPrice = products.length > 0
    ? products.reduce((sum, p) => sum + p.price_cents, 0) / products.length / 100
    : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  const statusActive = store.status === 'active';

  return (
    <div className="flex flex-col flex-1 space-y-4">
      {/* Store header — branding clean, palette strict, avatar locked to monogram */}
      <div className="border border-admin-border rounded-admin-lg shadow-admin-card bg-admin-bg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-admin-border-soft">
          <StoreAvatar slug={store.slug} name={store.name} size={40} />
          <div className="min-w-0 flex-1">
            {/* H1 — page title, 24px tracked, real hierarchy */}
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-admin-text leading-tight truncate">
              {store.name}
            </h1>
            {store.tagline && (
              <p className="text-[12px] text-admin-text-muted truncate mt-0.5">{store.tagline}</p>
            )}
          </div>
          <div className="shrink-0">
            <StoreActions storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <div className="p-4">
          {/* KPI grid — values capped at text-xl (20px), never bigger than H1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Produits" value={products.length.toString()} />
            <Stat label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
            <Stat label="Marge moy." value={`${margin.toFixed(2)} €`} />
            <Stat label="Statut" value={statusActive ? 'En ligne' : store.status} highlight={statusActive} />
          </div>

          {/* Meta info — H3 inline labels, body 13px */}
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            <Row label="Niche">{store.niche || '—'}</Row>
            <Row label="Fournisseurs">
              {Object.entries(supplierCounts).map(([s, count]) => `${s} (${count})`).join(', ') || '—'}
            </Row>
            {store.medusa_publishable_key && (
              <Row label="Clé API" full>
                <code className="text-[11px] bg-admin-bg-muted text-admin-text-secondary px-2 py-0.5 rounded font-mono">
                  {store.medusa_publishable_key.slice(0, 24)}…
                </code>
              </Row>
            )}
            {store.description && (
              <Row label="Description" full>{store.description}</Row>
            )}
            <Row label="Domaine">{store.custom_domain || '—'}</Row>
            {store.error_message && !statusActive && (
              <Row label="Erreur" full>
                <span className="text-admin-text-secondary">{store.error_message}</span>
                <Link
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  className="ml-3 text-[12px] text-admin-accent hover:underline font-medium"
                >
                  Recréer ce store
                </Link>
              </Row>
            )}
          </dl>
        </div>
      </div>

      {/* Catalogue teaser */}
      <div className="rounded-admin-lg border border-admin-border bg-admin-bg shadow-admin-card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-admin-text-muted font-medium">Catalogue</p>
          <p className="mt-1 text-[13px] text-admin-text-secondary">
            <span className="font-semibold text-admin-text tabular-nums">{products.length}</span>{' '}
            produit{products.length > 1 ? 's' : ''} importé{products.length > 1 ? 's' : ''}.
          </p>
        </div>
        <ButtonLink href={`/admin/stores/${store.id}/catalog`} variant="primary" size="md">
          Voir le catalogue
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * Standard KPI tile — value is text-xl (20px), capped below the H1 so
 * the hierarchy reads page-title → kpi-value → body. Highlight tone
 * uses the brand accent (blue) for positive states.
 */
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-admin-border bg-admin-bg rounded-admin-md px-3.5 py-3 shadow-admin-card">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-admin-text-muted font-medium">
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full', highlight ? 'bg-admin-accent' : 'bg-admin-text-faint')}
          aria-hidden
        />
        {label}
      </div>
      <div
        className={cn(
          'mt-1.5 text-[20px] font-semibold tracking-[-0.02em] tabular-nums leading-none',
          highlight ? 'text-admin-accent' : 'text-admin-text',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-baseline gap-2 min-w-0', full && 'md:col-span-2')}>
      <dt className="text-admin-text-secondary font-medium shrink-0">{label} :</dt>
      <dd className="text-admin-text-muted min-w-0 truncate">{children}</dd>
    </div>
  );
}
