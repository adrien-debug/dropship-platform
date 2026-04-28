import Link from 'next/link';
import { medusa, type MedusaProduct } from '@/lib/medusa';

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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catalogue Medusa</h2>
        <p className="text-sm text-zinc-500">{products.length} produit(s)</p>
      </div>
      {error && <div className="border border-red-200 bg-red-50 text-red-800 p-4 rounded">{error}</div>}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 text-sm">
            <tr>
              <th className="text-left p-3">Image</th>
              <th className="text-left p-3">Titre</th>
              <th className="text-left p-3">Handle</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Variantes</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt="" className="w-12 h-12 rounded object-cover bg-zinc-100" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-zinc-100" />
                  )}
                </td>
                <td className="p-3 font-medium text-sm">{p.title}</td>
                <td className="p-3 text-xs text-zinc-500">{p.handle}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${p.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-700'}`}>{p.status}</span>
                </td>
                <td className="p-3 text-sm">{p.variants?.length ?? 0}</td>
                <td className="p-3 text-right">
                  <Link href={`/products/${p.handle}`} className="text-sm underline" target="_blank">Voir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
