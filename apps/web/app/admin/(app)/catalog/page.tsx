import Link from 'next/link';
import { medusa, type MedusaProduct } from '@/lib/medusa';
import { PageHeader, StatusPill } from '@/app/admin/_components/AdminUI';
// StatusPill is used in product rows (emerald/neutral for published status)

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  let products: MedusaProduct[] = [];
  let error: string | null = null;
  try {
    const r = await medusa.getProducts({ limit: 50 });
    products = r.products;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erreur';
  }

  const published = products.filter((p) => p.status === 'published').length;
  const drafts = products.length - published;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      <PageHeader
        kicker="Production · Medusa"
        title={
          <>
            Catalogue <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>Medusa</em>
          </>
        }
        lede="Tous les SKU publiés par l'agent. Source de vérité du stock e-commerce, indépendante des storefronts."
        actions={
          <span style={{ fontSize: 11, color: 'var(--ct-text-faint)', fontVariantNumeric: 'tabular-nums' }}>
            {products.length} produit{products.length > 1 ? 's' : ''}
            {drafts > 0 ? ` · ${drafts} brouillon${drafts > 1 ? 's' : ''}` : ''}
            {published > 0 ? ` · ${published} publié${published > 1 ? 's' : ''}` : ''}
          </span>
        }
      />

      {error && (
        <div className="ct-card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-muted)', fontWeight: 700 }}>Erreur Medusa</p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--ct-text-muted)' }}>{error}</p>
        </div>
      )}

      {!error && products.length === 0 && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--ct-border-strong)', borderRadius: 12, background: 'var(--ct-surface-1)' }}>
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ct-text-primary)' }}>Aucun produit publie pour le moment.</p>
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ct-text-muted)' }}>Lance l&apos;agent pour publier les premiers SKU.</p>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--ct-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--ct-surface-1)' }}>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', minWidth: 760, fontSize: 13, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--ct-surface-2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-faint)', borderBottom: '1px solid var(--ct-border)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500, width: 64 }}></th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Produit</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Handle</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Statut</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Variantes</th>
                  <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
                    <td style={{ padding: '12px 20px' }}>
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: 'var(--ct-surface-3)', border: '1px solid var(--ct-border)' }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--ct-surface-3)', border: '1px solid var(--ct-border)' }} />
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--ct-text-primary)' }}>{p.title}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <code style={{ fontSize: 11, color: 'var(--ct-text-muted)', fontFamily: 'monospace' }}>{p.handle}</code>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusPill tone={p.status === 'published' ? 'emerald' : 'neutral'}>
                        {p.status}
                      </StatusPill>
                    </td>
                    <td style={{ padding: '12px 20px', color: 'var(--ct-text-body)', fontVariantNumeric: 'tabular-nums' }}>{p.variants?.length ?? 0}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <Link
                        href={`/products/${p.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: 'var(--ct-text-muted)', textDecoration: 'underline', textUnderlineOffset: 4 }}
                      >
                        Ouvrir <span aria-hidden>&#8599;</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
