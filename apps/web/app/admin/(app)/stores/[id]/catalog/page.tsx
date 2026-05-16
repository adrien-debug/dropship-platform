import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { PageHeader, SectionCard, StatCard, StatusPill } from '@/app/admin/_components/AdminUI';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  supplier: string;
  external_id: string;
  supplier_url: string | null;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  image_quality_score: string | null; // numeric(3,2) comes back as string
  created_at: string;
}

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  logo_emoji: string;
  niche: string;
}

export default async function StoreCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, logo_emoji, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const { rows: products } = await db.query<ProductRow>(
    `SELECT id, supplier, external_id, supplier_url, enriched_title, enriched_description,
            price_cents, cost_cents, image_url, medusa_product_id,
            image_quality_score, created_at
       FROM dropship_store_products
      WHERE store_id = $1
      ORDER BY created_at ASC`,
    [storeId],
  );

  const totalRetailCents = products.reduce((s, p) => s + p.price_cents, 0);
  const totalCostCents = products.reduce((s, p) => s + p.cost_cents, 0);
  const totalMarginCents = totalRetailCents - totalCostCents;
  const avgMargin = products.length > 0 ? totalMarginCents / products.length / 100 : 0;
  const avgPrice = products.length > 0 ? totalRetailCents / products.length / 100 : 0;

  const supplierCounts = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.supplier] = (acc[p.supplier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 space-y-4">
      <PageHeader
        kicker="Catalogue"
        title={<span>Produits <em className="italic text-zinc-400">du store</em></span>}
        lede={`Niche · ${store.niche} · Géré par l'agent à la création, modifiable via Curation.`}
        actions={
          <Link
            href={`/admin/stores/${id}/copilot`}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Discuter avec le copilote
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Produits" value={products.length.toString()} />
        <StatCard label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
        <StatCard
          label="Marge moy."
          value={`${avgMargin.toFixed(2)} €`}
          tone={avgMargin > 0 ? 'emerald' : 'neutral'}
        />
        <StatCard
          label="Fournisseurs"
          value={Object.keys(supplierCounts).length.toString()}
          hint={Object.entries(supplierCounts).map(([s, c]) => `${s}·${c}`).join(' / ') || '—'}
        />
      </div>

      <SectionCard
        kicker="Table"
        title={<span>{products.length} produit{products.length > 1 ? 's' : ''}</span>}
        className="flex-1 min-h-0"
      >
        {products.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-zinc-400">
              Aucun produit dans ce store. Utilise le{' '}
              <Link href={`/admin/stores/${id}/copilot`} className="text-blue-600 underline">
                copilote de curation
              </Link>{' '}
              pour en ajouter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-label text-zinc-400 bg-zinc-50/60 border-y border-zinc-200/70">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Produit</th>
                  <th className="text-left font-medium px-3 py-3">Source</th>
                  <th className="text-right font-medium px-3 py-3">Coût</th>
                  <th className="text-right font-medium px-3 py-3">Prix</th>
                  <th className="text-right font-medium px-3 py-3">Marge</th>
                  <th className="text-right font-medium px-3 py-3">Image</th>
                  <th className="text-right font-medium px-5 py-3">État</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = (p.price_cents - p.cost_cents) / 100;
                  const marginPct = p.cost_cents > 0
                    ? Math.round(((p.price_cents - p.cost_cents) / p.cost_cents) * 100)
                    : 0;
                  const supplierTone: 'neutral' | 'emerald' = p.supplier === 'ai-generated' ? 'neutral' : 'emerald';
                  return (
                    <tr key={p.id} className="border-b border-zinc-200 last:border-0 hover:bg-zinc-50/60">
                      <td className="px-5 py-3 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 shrink-0">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                {store.logo_emoji}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-zinc-900 font-medium truncate max-w-[28ch]">
                              {p.enriched_title}
                            </div>
                            <div className="text-xs text-zinc-400 truncate max-w-[36ch]">
                              {p.enriched_description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <StatusPill tone={supplierTone}>{p.supplier}</StatusPill>
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-zinc-600 tabular-nums">
                        {(p.cost_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-medium text-zinc-900 tabular-nums">
                        {(p.price_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        <span className="text-blue-600 font-medium">
                          +{margin.toFixed(2)} €
                        </span>
                        <span className="block text-xs text-zinc-400">{marginPct}%</span>
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-zinc-600 tabular-nums">
                        {p.image_quality_score != null
                          ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 align-middle text-right">
                        {p.medusa_product_id ? (
                          <StatusPill tone="emerald">Live</StatusPill>
                        ) : (
                          <StatusPill tone="neutral">En attente</StatusPill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
