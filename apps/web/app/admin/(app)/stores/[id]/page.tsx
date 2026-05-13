import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { StoreLogo } from '@/components/ui';
import { StoreActions } from '../StoreActions';

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

  return (
    <div className="space-y-6">
      {/* Store header — branding + destructive actions only.
          Navigation lives in the StoreTabs rendered by the layout. */}
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <div className="h-16 flex items-center px-6 gap-4" style={{ backgroundColor: store.primary_color || '#111827' }}>
          <span className="text-white inline-flex"><StoreLogo emoji={store.logo_emoji} size={28} strokeWidth={1.5} /></span>
          <div className="text-white">
            <h2 className="text-xl font-bold">{store.name}</h2>
            {store.tagline && <p className="text-sm opacity-75">{store.tagline}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StoreActions storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <div className="p-6 bg-ds-surface-subtle">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Produits" value={products.length.toString()} />
            <Stat label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
            <Stat label="Marge moy." value={`${margin.toFixed(2)} €`} />
            <Stat label="Statut" value={store.status} highlight={store.status === 'active'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-ds-text-secondary">
            <div>
              <span className="font-medium">Niche :</span> {store.niche}
            </div>
            <div>
              <span className="font-medium">Fournisseurs :</span>{' '}
              {Object.entries(supplierCounts).map(([s, count]) => `${s} (${count})`).join(', ') || '—'}
            </div>
            {store.medusa_publishable_key && (
              <div className="col-span-2">
                <span className="font-medium">Clé API :</span>{' '}
                <code className="text-xs bg-ds-surface-default px-2 py-0.5 rounded">{store.medusa_publishable_key.slice(0, 24)}…</code>
              </div>
            )}
            {store.description && (
              <div className="col-span-2">
                <span className="font-medium">Description :</span> {store.description}
              </div>
            )}
            <div>
              <span className="font-medium">Domaine :</span> {store.custom_domain || '—'}
            </div>
            {store.error_message && store.status !== 'active' && (
              <div className="col-span-2 text-[var(--danger)]">
                <span className="font-medium">Erreur :</span> {store.error_message}
                <Link
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  className="ml-3 text-xs text-indigo-600 hover:underline font-medium"
                >
                  → Recréer ce store
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-store product list lives on its own tab (`Catalogue`).
          Keep the overview clean: just a teaser linking there. */}
      <div className="rounded-xl border border-ds-border-subtle bg-ds-surface-subtle p-6 flex items-center justify-between">
        <div>
          <p className="text-kicker uppercase tracking-label text-ds-text-muted font-medium">Catalogue</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            <span className="font-medium text-ds-text-primary">{products.length}</span>{' '}
            produit{products.length > 1 ? 's' : ''} importé{products.length > 1 ? 's' : ''}.
          </p>
        </div>
        <Link
          href={`/admin/stores/${store.id}/catalog`}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
        >
          Voir le catalogue →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-ds-surface-subtle rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${highlight ? 'text-green-600' : 'text-ds-text-primary'}`}>{value}</div>
      <div className="text-xs text-ds-text-muted mt-0.5">{label}</div>
    </div>
  );
}
