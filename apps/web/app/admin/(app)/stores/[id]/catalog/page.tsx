import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { PageHeader, SectionCard, StatCard, StatusPill } from '../../../../_components/AdminUI';

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
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, logo_emoji, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
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
    [id],
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
    <div className="space-y-6">
      <PageHeader
        kicker="Catalogue"
        title={<span>Produits <em className="italic text-ds-text-muted">du store</em></span>}
        lede={`Niche · ${store.niche} · Géré par l'agent à la création, modifiable via Curation.`}
        actions={
          <Link
            href={`/admin/stores/${id}/curate`}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
          >
            Discuter avec le copilote →
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      >
        {products.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-ds-text-muted">
              Aucun produit dans ce store. Utilise le{' '}
              <Link href={`/admin/stores/${id}/curate`} className="text-ds-text-primary underline">
                copilote de curation
              </Link>{' '}
              pour en ajouter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-label text-ds-text-muted bg-ds-surface-subtle/60 border-y border-ds-border-subtle/70">
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
                  const supplierTone = p.supplier === 'ai-generated' ? 'red' : 'blue';
                  return (
                    <tr key={p.id} className="border-b border-ds-border-subtle last:border-0 hover:bg-ds-surface-subtle/60">
                      <td className="px-5 py-3 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-ds-surface-default shrink-0">
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
                            <div className="text-ds-text-primary font-medium truncate max-w-[28ch]">
                              {p.enriched_title}
                            </div>
                            <div className="text-xs text-ds-text-muted truncate max-w-[36ch]">
                              {p.enriched_description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <StatusPill tone={supplierTone}>{p.supplier}</StatusPill>
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-ds-text-secondary tabular-nums">
                        {(p.cost_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-medium text-ds-text-primary tabular-nums">
                        {(p.price_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 align-middle text-right tabular-nums">
                        <span className="text-[var(--success)] font-medium">
                          +{margin.toFixed(2)} €
                        </span>
                        <span className="block text-xs text-ds-text-muted">{marginPct}%</span>
                      </td>
                      <td className="px-3 py-3 align-middle text-right text-ds-text-secondary tabular-nums">
                        {p.image_quality_score != null
                          ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 align-middle text-right">
                        {p.medusa_product_id ? (
                          <StatusPill tone="emerald">Live</StatusPill>
                        ) : (
                          <StatusPill tone="amber">En attente</StatusPill>
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
