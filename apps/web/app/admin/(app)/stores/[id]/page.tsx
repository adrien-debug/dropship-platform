import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { StoreActions } from '../StoreActions';
import { StoreAnalyticsForm } from './StoreAnalyticsForm';
import { StoreTemplateForm } from './StoreTemplateForm';

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
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
  template: 'auto' | 'mono' | 'collection-grid' | 'collection-editorial';
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
  const db = getDb();

  const storeRes = await db.query<StoreDetailRow>(
    `SELECT id, slug, name, niche, tagline, description, logo_emoji, primary_color, accent_color,
            status, product_count, medusa_sales_channel_id, medusa_publishable_key,
            error_message, created_at, updated_at,
            ga4_measurement_id, meta_pixel_id, meta_capi_token,
            tiktok_pixel_id, tiktok_events_token, clarity_id,
            template
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
      <div className="flex items-center gap-3">
        <Link href="/admin/stores" className="text-sm text-zinc-400 hover:underline">← Stores</Link>
      </div>

      {/* Store header */}
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <div className="h-16 flex items-center px-6 gap-4" style={{ backgroundColor: store.primary_color || '#111827' }}>
          <span className="text-3xl">{store.logo_emoji || '🛍️'}</span>
          <div className="text-white">
            <h2 className="text-xl font-bold">{store.name}</h2>
            {store.tagline && <p className="text-sm opacity-75">{store.tagline}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {store.status === 'active' && (
              <>
                <Link
                  href={`/admin/stores/${store.id}/analytics`}
                  className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  Analytics
                </Link>
                <Link
                  href={`/shop/${store.slug}`}
                  target="_blank"
                  className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  Voir le store →
                </Link>
              </>
            )}
            <StoreActions storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <div className="p-6 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Produits" value={products.length.toString()} />
            <Stat label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
            <Stat label="Marge moy." value={`${margin.toFixed(2)} €`} />
            <Stat label="Statut" value={store.status} highlight={store.status === 'active'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-600">
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
                <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded">{store.medusa_publishable_key.slice(0, 24)}…</code>
              </div>
            )}
            {store.description && (
              <div className="col-span-2">
                <span className="font-medium">Description :</span> {store.description}
              </div>
            )}
            {store.error_message && store.status !== 'active' && (
              <div className="col-span-2 text-red-600">
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

      <StoreTemplateForm
        storeId={store.id}
        storeSlug={store.slug}
        initial={store.template}
      />

      <StoreAnalyticsForm
        storeId={store.id}
        initial={{
          ga4MeasurementId: store.ga4_measurement_id ?? '',
          metaPixelId: store.meta_pixel_id ?? '',
          metaCapiToken: store.meta_capi_token ?? '',
          tiktokPixelId: store.tiktok_pixel_id ?? '',
          tiktokEventsToken: store.tiktok_events_token ?? '',
          clarityId: store.clarity_id ?? '',
        }}
      />

      {/* Products list */}
      <div>
        <h3 className="text-lg font-bold mb-4">Produits ({products.length})</h3>

        {products.length === 0 ? (
          <p className="text-zinc-400 text-sm">Aucun produit importé.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const margin = ((product.price_cents - product.cost_cents) / 100).toFixed(2);
              const marginPct = product.cost_cents > 0
                ? Math.round(((product.price_cents - product.cost_cents) / product.cost_cents) * 100)
                : 0;

              return (
                <div key={product.id} className="border rounded-xl bg-white flex gap-4 p-4 hover:shadow-sm transition-shadow">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt={product.enriched_title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">{store.logo_emoji}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h4 className="font-medium text-sm text-zinc-900 line-clamp-1 flex-1">{product.enriched_title}</h4>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        product.supplier === 'ai-generated'
                          ? 'bg-purple-100 text-purple-700'
                          : product.supplier === 'aliexpress'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {product.supplier}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{product.enriched_description}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <div className="font-bold text-sm">{(product.price_cents / 100).toFixed(2)} €</div>
                    <div className="text-xs text-zinc-400">coût {(product.cost_cents / 100).toFixed(2)} €</div>
                    <div className="text-xs text-green-600 font-medium">+{margin} € ({marginPct}%)</div>
                    {product.medusa_product_id && (
                      <div className="text-kicker text-zinc-300 font-mono">{product.medusa_product_id.slice(0, 12)}…</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-zinc-50 rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${highlight ? 'text-green-600' : 'text-zinc-900'}`}>{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}
