import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTemplateEntry, type StoreTemplate } from '@/lib/template-catalog';
import { buildMockStore, buildMockProducts } from '@/lib/template-preview-mock';
import { MonoProductLanding } from '@/app/shop/[slug]/MonoProductLanding';
import { CollectionEditorialLanding } from '@/app/shop/[slug]/CollectionEditorialLanding';
import { LuxuryMinimalLanding } from '@/app/shop/[slug]/LuxuryMinimalLanding';
import { GenZBoldLanding } from '@/app/shop/[slug]/GenZBoldLanding';
import { EditorialFashionLanding } from '@/app/shop/[slug]/EditorialFashionLanding';
import { WellnessSoftLanding } from '@/app/shop/[slug]/WellnessSoftLanding';
import { LuxuryMonoLanding } from '@/app/shop/[slug]/LuxuryMonoLanding';
import { WellnessSerenityLanding } from '@/app/shop/[slug]/WellnessSerenityLanding';
import { WellnessPulseLanding } from '@/app/shop/[slug]/WellnessPulseLanding';
import { WellnessDanceLanding } from '@/app/shop/[slug]/WellnessDanceLanding';
import { WellnessStudioLanding } from '@/app/shop/[slug]/WellnessStudioLanding';
import { WellnessRetreatLanding } from '@/app/shop/[slug]/WellnessRetreatLanding';
import { WellnessFitnessBlogLanding } from '@/app/shop/[slug]/WellnessFitnessBlogLanding';
import { WellnessMassageQuietLanding } from '@/app/shop/[slug]/WellnessMassageQuietLanding';
import { WellnessOnyxGymLanding } from '@/app/shop/[slug]/WellnessOnyxGymLanding';
import { EventsMusicartLanding } from '@/app/shop/[slug]/EventsMusicartLanding';
import { EventsBouquetLanding } from '@/app/shop/[slug]/EventsBouquetLanding';
import { EventsArcadiumLanding } from '@/app/shop/[slug]/EventsArcadiumLanding';
import { EventsSummitLanding } from '@/app/shop/[slug]/EventsSummitLanding';
import { EventsConvergeLanding } from '@/app/shop/[slug]/EventsConvergeLanding';
import { FashionBoutique1622Landing } from '@/app/shop/[slug]/FashionBoutique1622Landing';
import { BeautySalon2851Landing } from '@/app/shop/[slug]/BeautySalon2851Landing';
import { FioraLocksLanding } from '@/app/shop/[slug]/FioraLocksLanding';
import { AdventureTravel2787Landing } from '@/app/shop/[slug]/AdventureTravel2787Landing';

export const dynamic = 'force-dynamic';

const REGISTRY: Record<string, React.ComponentType<{ store: ReturnType<typeof buildMockStore>; products: ReturnType<typeof buildMockProducts> }>> = {
  'collection-editorial': CollectionEditorialLanding,
  'luxury-minimal': LuxuryMinimalLanding,
  'gen-z-bold': GenZBoldLanding,
  'editorial-fashion': EditorialFashionLanding,
  'wellness-soft': WellnessSoftLanding,
  'luxury-mono': LuxuryMonoLanding,
  'wellness-serenity': WellnessSerenityLanding,
  'wellness-pulse': WellnessPulseLanding,
  'wellness-dance': WellnessDanceLanding,
  'wellness-studio': WellnessStudioLanding,
  'wellness-retreat': WellnessRetreatLanding,
  'wellness-fitness-blog': WellnessFitnessBlogLanding,
  'wellness-massage-quiet': WellnessMassageQuietLanding,
  'wellness-onyx-gym': WellnessOnyxGymLanding,
  'events-musicart': EventsMusicartLanding,
  'events-bouquet': EventsBouquetLanding,
  'events-arcadium': EventsArcadiumLanding,
  'events-summit': EventsSummitLanding,
  'events-converge': EventsConvergeLanding,
  'fashion-boutique-1622': FashionBoutique1622Landing,
  'beauty-salon-2851': BeautySalon2851Landing,
  'fiora-locks-wh1270': FioraLocksLanding,
  'adventure-travel-2787': AdventureTravel2787Landing,
};

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getTemplateEntry(id);
  if (!entry) notFound();

  const store = buildMockStore(id as StoreTemplate);
  const products = buildMockProducts();

  const Comp = REGISTRY[id];

  // Fallback for templates without a dedicated Landing component
  // (mono → MonoProductLanding takes a single `product`, collection-grid
  // has no component — we render a quick notice instead).
  if (!Comp && id === 'mono') {
    return (
      <>
        <PreviewBar entry={entry} id={id} />
        <MonoProductLanding store={store} product={products[0]!} />
      </>
    );
  }
  if (!Comp) {
    return (
      <>
        <PreviewBar entry={entry} id={id} />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ct-surface-1)', padding: '0 24px' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--ct-text-muted)', fontWeight: 600 }}>
              {id}
            </p>
            <h1 className="ct-title" style={{ marginTop: 8 }}>
              Pas de preview d&eacute;di&eacute;
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ct-text-body)', lineHeight: 1.6 }}>
              Ce template ({entry.label}) utilise le rendu par d&eacute;faut du
              storefront. Pour le voir en contexte, assigne-le &agrave; une boutique
              r&eacute;elle depuis ses r&eacute;glages.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PreviewBar entry={entry} id={id} />
      <Comp store={store} products={products} />
    </>
  );
}

function PreviewBar({ entry, id }: { entry: NonNullable<ReturnType<typeof getTemplateEntry>>; id: string }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 200, background: 'var(--ct-surface-0)', borderBottom: '1px solid var(--ct-border)' }}>
      <div style={{ maxWidth: '96rem', margin: '0 auto', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ct-accent)' }}>Preview</span>
          <span style={{ color: 'var(--ct-text-faint)' }}>&middot;</span>
          <span style={{ color: 'var(--ct-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
          <code style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--ct-text-faint)', marginLeft: 8 }}>{id}</code>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ct-text-faint)' }}>Donn&eacute;es fictives</span>
          <Link
            href="/admin/templates"
            style={{ background: 'var(--ct-surface-2)', border: '1px solid var(--ct-border)', borderRadius: 6, padding: '4px 12px', fontWeight: 500, color: 'var(--ct-text-muted)', textDecoration: 'none', fontSize: 12 }}
          >
            &larr; Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
