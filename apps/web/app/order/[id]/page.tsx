import Link from 'next/link';
import { StoreShell } from '@/app/_components/StoreShell';
import { resolveActiveStore } from '@/lib/active-store';

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await resolveActiveStore(null);
  const boutiqueHref = store ? `/shop/${store.slug}` : '/products';
  return (
    <StoreShell store={store}>
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1
          className="text-3xl font-bold"
          style={{ color: 'var(--ct-text-strong, #fff)' }}
        >
          Merci pour votre commande
        </h1>
        <p
          className="mt-3"
          style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
        >
          Référence :{' '}
          <code
            className="px-2 py-1 rounded text-sm"
            style={{
              backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))',
              color: 'var(--ct-text-primary, rgba(245,245,245,0.92))',
            }}
          >
            {id}
          </code>
        </p>
        <p
          className="mt-2"
          style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
        >
          Un email de confirmation vous sera envoyé.
        </p>
        <Link
          href={boutiqueHref}
          className="mt-8 inline-block underline"
          style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
        >
          Continuer mes achats
        </Link>
      </section>
    </StoreShell>
  );
}
