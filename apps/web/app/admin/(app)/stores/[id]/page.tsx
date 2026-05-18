import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { StoreAvatar, ButtonLink } from '@/components/ui';
import { StoreActions } from '../StoreActions';
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';

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
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
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
    [storeId],
  );

  const store = storeRes.rows[0];
  if (!store) notFound();

  const productsRes = await db.query<ProductRow>(
    `SELECT id, supplier, enriched_title, enriched_description, price_cents, cost_cents,
            image_url, supplier_url, medusa_product_id, created_at
     FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC`,
    [storeId],
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
      {/* Store header */}
      <div style={{ border: '1px solid var(--ct-border)', borderRadius: 12, background: 'var(--ct-surface-1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--ct-border-soft)' }}>
          <StoreAvatar slug={store.slug} name={store.name} size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="ct-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {store.name}
            </h1>
            {store.tagline && (
              <p style={{ fontSize: 12, color: 'var(--ct-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{store.tagline}</p>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            <StoreActions storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* KPI grid */}
          <KpiGrid className="mb-4">
            <KpiCard label="Produits" value={products.length.toString()} />
            <KpiCard label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
            <KpiCard label="Marge moy." value={`${margin.toFixed(2)} €`} />
            <KpiCard label="Statut" value={statusActive ? 'En ligne' : store.status} accent={statusActive} />
          </KpiGrid>

          {/* Meta info */}
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 8, fontSize: 13 }}>
            <Row label="Niche">{store.niche || '—'}</Row>
            <Row label="Fournisseurs">
              {Object.entries(supplierCounts).map(([s, count]) => `${s} (${count})`).join(', ') || '—'}
            </Row>
            {store.medusa_publishable_key && (
              <Row label="Clé API" full>
                <code style={{ fontSize: 11, background: 'var(--ct-surface-3)', color: 'var(--ct-text-body)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {store.medusa_publishable_key.slice(0, 24)}&hellip;
                </code>
              </Row>
            )}
            {store.description && (
              <Row label="Description" full>{store.description}</Row>
            )}
            <Row label="Domaine">{store.custom_domain || '—'}</Row>
            {store.error_message && !statusActive && (
              <Row label="Erreur" full>
                <span style={{ color: 'var(--ct-text-muted)' }}>{store.error_message}</span>
                <Link
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  style={{ marginLeft: 12, fontSize: 12, color: 'var(--ct-accent)', fontWeight: 500, textDecoration: 'underline' }}
                >
                  Recr&eacute;er ce store
                </Link>
              </Row>
            )}
          </dl>
        </div>
      </div>

      {/* Catalogue teaser */}
      <div style={{ borderRadius: 12, border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ct-text-muted)', fontWeight: 700 }}>Catalogue</p>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ct-text-body)' }}>
            <span style={{ fontWeight: 600, color: 'var(--ct-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{products.length}</span>{' '}
            produit{products.length > 1 ? 's' : ''} import&eacute;{products.length > 1 ? 's' : ''}.
          </p>
        </div>
        <ButtonLink href={`/admin/stores/${store.id}/catalog`} variant="primary" size="md">
          Voir le catalogue
        </ButtonLink>
      </div>
    </div>
  );
}

// Stat is no longer used directly — replaced by KpiCard primitive in the store detail page.
// Keeping for reference; cn import is still needed for Row.
function Row({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, gridColumn: full ? 'span 2' : undefined }}>
      <dt style={{ color: 'var(--ct-text-muted)', fontWeight: 500, flexShrink: 0 }}>{label} :</dt>
      <dd style={{ color: 'var(--ct-text-body)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</dd>
    </div>
  );
}
