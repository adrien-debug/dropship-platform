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
          <h1 className="ct-title mb-6">
            Votre panier est vide
          </h1>
          <Link
            href={boutiqueHref}
            className="inline-block text-base underline underline-offset-4 hover:no-underline"
            style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
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
        <h1 className="ct-title mb-12">
          Panier
        </h1>
        <div
          className="rounded-2xl overflow-hidden border"
          style={{ borderColor: 'var(--ct-border, rgba(255,255,255,0.10))' }}
        >
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead
              className="text-xs uppercase tracking-cta font-medium"
              style={{
                backgroundColor: 'var(--ct-surface-1, rgba(255,255,255,0.04))',
                color: 'var(--ct-text-muted, rgba(245,245,245,0.48))',
              }}
            >
              <tr>
                <th className="text-left p-6">Produit</th>
                <th className="text-left p-6">Qté</th>
                <th className="text-right p-6">Total</th>
                <th className="p-6"></th>
              </tr>
            </thead>
            <tbody
              className="divide-y"
              style={{ '--tw-divide-color': 'var(--ct-border-soft, rgba(255,255,255,0.06))' } as React.CSSProperties}
            >
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
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-full text-sm font-medium uppercase tracking-cta transition-all duration-300 hover:-translate-y-0.5"
            style={{
              backgroundColor: 'var(--ct-accent)',
              color: 'var(--ct-text-strong)',
              boxShadow: '0 22px 40px -18px rgba(190,18,60,0.45)',
            }}
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
  if (bold) {
    return (
      <div
        className="flex justify-between font-semibold tracking-tight text-2xl border-t pt-4 mt-2"
        style={{
          color: 'var(--ct-text-strong, #fff)',
          borderColor: 'var(--ct-border, rgba(255,255,255,0.10))',
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
    );
  }
  return (
    <div
      className="flex justify-between"
      style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
