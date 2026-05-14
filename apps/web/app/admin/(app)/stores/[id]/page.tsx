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
    <div className="flex flex-col flex-1 space-y-4">
      {/* Store header — branding + destructive actions only.
          Navigation lives in the StoreTabs rendered by the layout. */}
      <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="h-14 flex items-center px-5 gap-3" style={{ backgroundColor: store.primary_color || '#111827' }}>
          <span className="text-white inline-flex"><StoreLogo emoji={store.logo_emoji} size={24} strokeWidth={1.5} /></span>
          <div className="text-white min-w-0">
            <h2 className="text-base font-semibold truncate">{store.name}</h2>
            {store.tagline && <p className="text-xs opacity-75 truncate">{store.tagline}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <StoreActions storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <div className="p-4 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Produits" value={products.length.toString()} />
            <Stat label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
            <Stat label="Marge moy." value={`${margin.toFixed(2)} €`} />
            <Stat label="Statut" value={store.status} highlight={store.status === 'active'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-zinc-500">
            <div>
              <span className="font-medium text-zinc-900">Niche :</span> {store.niche}
            </div>
            <div>
              <span className="font-medium text-zinc-900">Fournisseurs :</span>{' '}
              {Object.entries(supplierCounts).map(([s, count]) => `${s} (${count})`).join(', ') || '—'}
            </div>
            {store.medusa_publishable_key && (
              <div className="col-span-2">
                <span className="font-medium text-zinc-900">Clé API :</span>{' '}
                <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded">{store.medusa_publishable_key.slice(0, 24)}…</code>
              </div>
            )}
            {store.description && (
              <div className="col-span-2">
                <span className="font-medium text-zinc-900">Description :</span> {store.description}
              </div>
            )}
            <div>
              <span className="font-medium text-zinc-900">Domaine :</span> {store.custom_domain || '—'}
            </div>
            {store.error_message && store.status !== 'active' && (
              <div className="col-span-2 text-zinc-500">
                <span className="font-medium text-zinc-900">Erreur :</span> {store.error_message}
                <Link
                  href={`/admin/stores/new?niche=${encodeURIComponent(store.niche)}&name=${encodeURIComponent(store.name)}`}
                  className="ml-3 text-xs text-blue-600 hover:underline font-medium"
                >
                  Recréer ce store
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-store product list lives on its own tab (`Catalogue`).
          Keep the overview clean: just a teaser linking there. */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Catalogue</p>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-medium text-zinc-900">{products.length}</span>{' '}
            produit{products.length > 1 ? 's' : ''} importé{products.length > 1 ? 's' : ''}.
          </p>
        </div>
        <Link
          href={`/admin/stores/${store.id}/catalog`}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Voir le catalogue
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-zinc-200 bg-white rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden />
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tracking-[-0.03em] ${highlight ? 'text-blue-600' : 'text-zinc-900'}`}>{value}</div>
    </div>
  );
}
