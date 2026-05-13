import Link from 'next/link';
import { medusa, type MedusaProduct } from '@/lib/medusa';
import { PageHeader, StatusPill } from '../../_components/AdminUI';

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
    <div className="space-y-8">
      <PageHeader
        kicker="Production · Medusa"
        title={
          <>
            Catalogue <em className="italic text-ds-text-muted">Medusa</em>
          </>
        }
        lede="Tous les SKU publiés par l’agent. Source de vérité du stock e-commerce, indépendante des storefronts."
        actions={
          <span className="text-xs text-ds-text-muted tabular-nums">
            {products.length} produit{products.length > 1 ? 's' : ''}
            {drafts > 0 ? ` · ${drafts} brouillon${drafts > 1 ? 's' : ''}` : ''}
          </span>
        }
      />

      {error && (
        <div className="border border-[var(--danger-muted)] bg-[var(--danger-muted)]/60 rounded-xl p-5">
          <p className="text-kicker uppercase tracking-label text-[var(--danger)] font-medium">Erreur Medusa</p>
          <p className="mt-1.5 text-sm text-red-900">{error}</p>
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="border border-dashed border-ds-border-subtle rounded-xl px-6 py-16 text-center bg-ds-surface-subtle">
          <p className="text-sm font-semibold tracking-tight text-ds-text-secondary">Aucun produit publié pour le moment.</p>
          <p className="mt-1 text-xs text-ds-text-muted">Lance l’agent pour publier les premiers SKU.</p>
        </div>
      )}

      {products.length > 0 && (
        <section className="border border-ds-border-subtle rounded-xl overflow-hidden bg-ds-surface-subtle">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-ds-surface-subtle/60 text-kicker uppercase tracking-header text-ds-text-muted">
                <tr>
                  <th className="text-left px-5 py-3 font-medium w-16"></th>
                  <th className="text-left px-5 py-3 font-medium">Produit</th>
                  <th className="text-left px-5 py-3 font-medium">Handle</th>
                  <th className="text-left px-5 py-3 font-medium">Statut</th>
                  <th className="text-left px-5 py-3 font-medium">Variantes</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-ds-surface-subtle/60 transition-colors">
                    <td className="px-5 py-3">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover bg-ds-surface-default border border-ds-border-subtle"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-ds-surface-default border border-ds-border-subtle" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-ds-text-primary">{p.title}</td>
                    <td className="px-5 py-3">
                      <code className="text-xs text-ds-text-muted font-mono">{p.handle}</code>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={p.status === 'published' ? 'emerald' : 'zinc'}>
                        {p.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-ds-text-secondary tabular-nums">{p.variants?.length ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/products/${p.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-ds-text-muted hover:text-ds-text-primary underline underline-offset-4 decoration-zinc-200 hover:decoration-zinc-500 transition-colors"
                      >
                        Ouvrir <span aria-hidden>↗</span>
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
