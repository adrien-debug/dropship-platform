'use client';

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Panier</h1>
      <div className="rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
        <p className="text-lg">Votre panier est vide</p>
        <a href="/shop" className="mt-4 inline-block text-sm text-black underline">Continuer vos achats</a>
      </div>
    </div>
  );
}
