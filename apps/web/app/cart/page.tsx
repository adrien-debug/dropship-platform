import Link from 'next/link';
import { loadCart } from '@/lib/store-cart';
import { formatMoney } from '@/lib/medusa-store';
import { resolveActiveStore } from '@/lib/active-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { CartLineRow } from './CartLineRow';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await loadCart();
  const store = await resolveActiveStore(cart);
  const boutiqueHref = store ? `/shop/${store.slug}` : '/products';

  if (!cart || cart.items.length === 0) {
    return (
      <StoreShell store={store}>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl mb-6 text-zinc-900">Votre panier est vide</h1>
          <Link
            href={boutiqueHref}
            className="inline-block text-base underline underline-offset-4 hover:no-underline text-zinc-700"
          >
            Parcourir la boutique
          </Link>
        </div>
      </StoreShell>
    );
  }
  const currency = cart.currency_code || 'eur';
  return (
    <StoreShell store={store}>
      <section className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-20">
        <h1 className="font-serif text-4xl sm:text-5xl mb-12 text-zinc-900">Panier</h1>
        <div className="border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-zinc-50 text-xs uppercase tracking-cta text-zinc-500 font-medium">
              <tr>
                <th className="text-left p-6">Produit</th>
                <th className="text-left p-6">Qté</th>
                <th className="text-right p-6">Total</th>
                <th className="p-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cart.items.map((item) => (
                <CartLineRow key={item.id} item={item} currency={currency} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 max-w-md ml-auto text-base">
          <Row label="Sous-total" value={formatMoney(cart.subtotal, currency)} />
          {cart.shipping_total ? <Row label="Livraison" value={formatMoney(cart.shipping_total, currency)} /> : null}
          {cart.tax_total ? <Row label="TVA" value={formatMoney(cart.tax_total, currency)} /> : null}
          <Row label="Total" value={formatMoney(cart.total, currency)} bold />
        </div>
        <div className="mt-12 flex justify-end">
          <Link
            href="/checkout"
            className="group inline-flex items-center gap-3 bg-zinc-950 text-white px-10 py-5 rounded-full text-sm font-medium uppercase tracking-cta transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-18px_rgba(0,0,0,0.55)] hover:bg-black"
          >
            Passer au paiement
            <svg
              aria-hidden="true"
              width="16"
              height="12"
              viewBox="0 0 14 10"
              fill="none"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path d="M0 5h12m0 0L8 1m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>
    </StoreShell>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between ${bold ? 'font-serif text-2xl text-zinc-900 border-t border-zinc-200 pt-4 mt-2' : 'text-zinc-600'}`}
    >
      <span>{label}</span>
      <span className={bold ? '' : 'text-zinc-900 font-medium'}>{value}</span>
    </div>
  );
}
