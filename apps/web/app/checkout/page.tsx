import Link from 'next/link';
import { loadCart } from '@/lib/store-cart';
import { listShippingOptions, formatMoney, type StoreShippingOption } from '@/lib/medusa-store';
import { resolveActiveStore } from '@/lib/active-store';
import { StoreShell } from '@/app/_components/StoreShell';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const cart = await loadCart();
  const store = await resolveActiveStore(cart);
  const boutiqueHref = store ? `/shop/${store.slug}` : '/products';

  if (!cart || cart.items.length === 0) {
    return (
      <StoreShell store={store}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Votre panier est vide</h1>
          <Link href={boutiqueHref} className="mt-4 inline-block underline">
            Retour boutique
          </Link>
        </div>
      </StoreShell>
    );
  }

  let shippingOptions: StoreShippingOption[] = [];
  let shippingError: string | null = null;
  try {
    if (cart.shipping_address?.country_code) {
      const r = await listShippingOptions(cart.id);
      shippingOptions = r.shipping_options;
    }
  } catch (e) {
    shippingError = e instanceof Error ? e.message : 'Erreur';
  }

  const stripePublishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
  // Only the publishable key is needed for the client-side Stripe Elements form.
  // The secret key is used (and validated) by the create-payment-session API
  // route — letting Stripe fail naturally there yields a clearer error than
  // a generic "Stripe not configured" message in the UI.
  const stripeEnabled = !!stripePublishableKey;

  return (
    <StoreShell store={store}>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <h1 className="text-3xl font-bold mb-6">Checkout</h1>
          <CheckoutForm
            cart={cart}
            shippingOptions={shippingOptions}
            shippingError={shippingError}
            stripeEnabled={stripeEnabled}
            stripePublishableKey={stripePublishableKey}
          />
        </div>
        <aside className="border rounded-lg p-6 h-fit space-y-3 text-sm">
          <h2 className="font-semibold mb-2">Récapitulatif</h2>
          {cart.items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span>{it.title} × {it.quantity}</span>
              <span>{formatMoney(it.total, cart.currency_code)}</span>
            </div>
          ))}
          <hr />
          <div className="flex justify-between"><span>Sous-total</span><span>{formatMoney(cart.subtotal, cart.currency_code)}</span></div>
          <div className="flex justify-between"><span>Livraison</span><span>{formatMoney(cart.shipping_total, cart.currency_code)}</span></div>
          {cart.tax_total ? <div className="flex justify-between"><span>TVA</span><span>{formatMoney(cart.tax_total, cart.currency_code)}</span></div> : null}
          <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span>{formatMoney(cart.total, cart.currency_code)}</span></div>
        </aside>
      </section>
    </StoreShell>
  );
}
