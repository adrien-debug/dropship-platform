import { getSiteConfig, getSiteContent } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const siteConfig = await getSiteConfig().catch(() => null);
  const content = siteConfig ? getSiteContent(siteConfig as Record<string, unknown>) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-ds-xl">
      <h1 className="mb-8 font-ds-display text-center" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
        Our Policies
      </h1>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold">Shipping</h2>
        {content?.shipping_policy ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.shipping_policy }} />
        ) : (
          <p className="text-[var(--ds-text-muted)]">
            Standard shipping within 7-15 business days. Shipping fees calculated at checkout.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Returns &amp; Refunds</h2>
        {content?.return_policy ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: content.return_policy }} />
        ) : (
          <p className="text-[var(--ds-text-muted)]">
            14-day return window. Contact us to initiate a return.
          </p>
        )}
      </section>
    </div>
  );
}
