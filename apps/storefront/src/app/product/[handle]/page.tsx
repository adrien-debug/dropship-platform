import { getProductByHandle } from '@/lib/products';
import { notFound } from 'next/navigation';

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-gray-50">
          {product.imageUrls[0] && (
            <img src={product.imageUrls[0]} alt={product.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">{product.category}</p>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-2xl font-bold">{(product.priceCents / 100).toFixed(2)} EUR</p>
          {product.shippingDays && (
            <p className="text-sm text-gray-500">Livraison: {product.shippingDays.min}-{product.shippingDays.max} jours</p>
          )}
          <div className="prose mt-4" dangerouslySetInnerHTML={{ __html: product.description }} />
          <button className="mt-6 w-full rounded-full bg-black py-3 font-medium text-white hover:bg-gray-800">
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}
