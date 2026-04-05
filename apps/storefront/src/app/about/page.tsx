import { getSiteConfig, getSiteContent } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const siteConfig = await getSiteConfig().catch(() => null);
  const content = siteConfig ? getSiteContent(siteConfig as Record<string, unknown>) : null;
  const siteName = (siteConfig as Record<string, unknown>)?.name as string | undefined;

  const aboutHtml = content?.about_html;

  return (
    <div className="mx-auto max-w-3xl px-4 py-ds-xl">
      <h1 className="mb-8 font-ds-display text-center" style={{ fontWeight: 'var(--ds-weight-black, 900)' }}>
        About{siteName ? ` ${siteName}` : ' Us'}
      </h1>
      {aboutHtml ? (
        <div className="prose prose-lg mx-auto" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
      ) : (
        <p className="text-center text-[var(--ds-text-muted)]">
          Content coming soon.
        </p>
      )}
    </div>
  );
}
