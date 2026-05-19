import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { PageHeader, StatusPill } from '@/app/admin/_components/AdminUI';
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
      <PageHeader
        kicker="Catalogue"
        title={<span>Produits <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>du store</em></span>}
        lede={`Niche · ${store.niche} · Géré par l'agent à la création, modifiable via Curation.`}
        actions={
          <Link
            href={`/admin/stores/${id}/copilot`}
            style={{ fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 8, background: 'var(--ct-accent)', color: '#fff', textDecoration: 'none' }}
          >
            Discuter avec le copilote
          </Link>
        }
      />

      <KpiGrid>
        <KpiCard label="Produits" value={products.length.toString()} />
        <KpiCard label="Prix moyen" value={`${avgPrice.toFixed(2)} €`} />
        <KpiCard label="Marge moy." value={`${avgMargin.toFixed(2)} €`} accent={avgMargin > 0} />
        <KpiCard
          label="Fournisseurs"
          value={Object.keys(supplierCounts).length.toString()}
        />
      </KpiGrid>

      <section style={{ flex: 1, minHeight: 0, border: '1px solid var(--ct-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--ct-surface-1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ct-border)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.01em' }}>
            {products.length} produit{products.length > 1 ? 's' : ''}
          </h3>
          {Object.entries(supplierCounts).length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--ct-text-faint)' }}>
              {Object.entries(supplierCounts).map(([s, c]) => `${s}·${c}`).join(' / ')}
            </span>
          )}
        </div>
        {products.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--ct-text-faint)' }}>
              Aucun produit dans ce store. Utilise le{' '}
              <Link href={`/admin/stores/${id}/copilot`} style={{ color: 'var(--ct-accent)', textDecoration: 'underline' }}>
                copilote de curation
              </Link>{' '}
              pour en ajouter.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-faint)', background: 'var(--ct-surface-2)', borderBottom: '1px solid var(--ct-border)' }}>
                <tr>
                  <th style={{ textAlign: 'left', fontWeight: 500, padding: '12px 20px' }}>Produit</th>
                  <th style={{ textAlign: 'left', fontWeight: 500, padding: '12px 12px' }}>Source</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '12px 12px' }}>Co&ucirc;t</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '12px 12px' }}>Prix</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '12px 12px' }}>Marge</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '12px 12px' }}>Image</th>
                  <th style={{ textAlign: 'right', fontWeight: 500, padding: '12px 20px' }}>&Eacute;tat</th>
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
                    <tr key={p.id} style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
                      <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--ct-surface-3)', flexShrink: 0, border: '1px solid var(--ct-border)' }}>
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                {store.logo_emoji}
                              </div>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--ct-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '28ch' }}>
                              {p.enriched_title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ct-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '36ch', marginTop: 2 }}>
                              {p.enriched_description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
                        <StatusPill tone={supplierTone}>{p.supplier}</StatusPill>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', color: 'var(--ct-text-body)', fontVariantNumeric: 'tabular-nums' }}>
                        {(p.cost_cents / 100).toFixed(2)} &euro;
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 500, color: 'var(--ct-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {(p.price_cents / 100).toFixed(2)} &euro;
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontWeight: 500, color: 'var(--ct-accent)' }}>+{margin.toFixed(2)} &euro;</span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--ct-text-faint)' }}>{marginPct}%</span>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', color: 'var(--ct-text-body)', fontVariantNumeric: 'tabular-nums' }}>
                        {p.image_quality_score != null
                          ? `${Math.round(parseFloat(p.image_quality_score) * 100)}%`
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
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
      </section>
    </div>
  );
}
