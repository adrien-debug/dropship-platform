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
            Catalogue <em className="italic text-zinc-400">Medusa</em>
          </>
        }
        lede="Tous les SKU publiés par l’agent. Source de vérité du stock e-commerce, indépendante des storefronts."
        actions={
          <span className="text-xs text-zinc-400 tabular-nums">
            {products.length} produit{products.length > 1 ? 's' : ''}
            {drafts > 0 ? ` · ${drafts} brouillon${drafts > 1 ? 's' : ''}` : ''}
          </span>
        }
      />

      {error && (
        <div className="border border-[var(--danger-muted)] bg-[var(--danger-muted)]/60 rounded-xl p-5">
          <p className="text-kicker uppercase tracking-label text-zinc-500 font-medium">Erreur Medusa</p>
          <p className="mt-1.5 text-sm text-zinc-500">{error}</p>
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-16 text-center bg-zinc-50">
          <p className="text-sm font-semibold tracking-tight text-zinc-600">Aucun produit publié pour le moment.</p>
          <p className="mt-1 text-xs text-zinc-400">Lance l’agent pour publier les premiers SKU.</p>
        </div>
      )}

      {products.length > 0 && (
        <section className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50/60 text-kicker uppercase tracking-header text-zinc-400">
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
                  <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover bg-zinc-100 border border-zinc-200"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-zinc-100 border border-zinc-200" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-zinc-900">{p.title}</td>
                    <td className="px-5 py-3">
                      <code className="text-xs text-zinc-400 font-mono">{p.handle}</code>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={p.status === 'published' ? 'emerald' : 'zinc'}>
                        {p.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 tabular-nums">{p.variants?.length ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/products/${p.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-400 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-200 hover:decoration-zinc-500 transition-colors"
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
