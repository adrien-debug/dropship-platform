import { getSiteConfig, getSiteContent } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const siteConfig = await getSiteConfig().catch(() => null);
  const content = siteConfig ? getSiteContent(siteConfig as Record<string, unknown>) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-ds-xl">
      <h1 className="mb-8 font-ds-display text-center" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
        Nos politiques
      </h1>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold">Livraison</h2>
        {content?.shipping_policy ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.shipping_policy }} />
        ) : (
          <p className="text-[var(--ds-text-muted)]">
            Livraison standard sous 7-15 jours ouvrables. Frais de livraison calcules au checkout.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Retours et remboursements</h2>
        {content?.return_policy ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.return_policy }} />
        ) : (
          <p className="text-[var(--ds-text-muted)]">
            Droit de retractation de 14 jours conformement a la legislation europeenne.
            Contactez-nous pour initier un retour.
          </p>
        )}
      </section>
    </div>
  );
}
