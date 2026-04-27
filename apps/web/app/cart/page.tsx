import Link from 'next/link';
import { loadCart } from '@/lib/store-cart';
import { formatMoney } from '@/lib/medusa-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { CartLineRow } from './CartLineRow';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await loadCart();
  if (!cart || cart.items.length === 0) {
    return (
      <StoreShell>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Votre panier est vide</h1>
          <Link href="/products" className="underline">Parcourir la boutique</Link>
        </div>
      </StoreShell>
    );
  }
  const currency = cart.currency_code || 'eur';
  return (
    <StoreShell>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold mb-8">Panier</h1>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50 text-sm text-zinc-600">
              <tr>
                <th className="text-left p-4">Produit</th>
                <th className="text-left p-4">Qté</th>
                <th className="text-right p-4">Total</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cart.items.map((item) => (
                <CartLineRow key={item.id} item={item} currency={currency} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-col gap-2 max-w-sm ml-auto text-sm">
          <Row label="Sous-total" value={formatMoney(cart.subtotal, currency)} />
          {cart.shipping_total ? <Row label="Livraison" value={formatMoney(cart.shipping_total, currency)} /> : null}
          {cart.tax_total ? <Row label="TVA" value={formatMoney(cart.tax_total, currency)} /> : null}
          <Row label="Total" value={formatMoney(cart.total, currency)} bold />
        </div>
        <div className="mt-8 flex justify-end">
          <Link href="/checkout" className="bg-black text-white px-6 py-3 rounded-md hover:bg-zinc-800">
            Passer au paiement
          </Link>
        </div>
      </section>
    </StoreShell>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold border-t pt-2' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
