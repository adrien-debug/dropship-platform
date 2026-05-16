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
        <main className="min-h-[60vh] flex items-center justify-center bg-zinc-50 px-6">
          <div className="max-w-md text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
              {id}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Pas de preview dédié
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Ce template ({entry.label}) utilise le rendu par défaut du
              storefront. Pour le voir en contexte, assigne-le à une boutique
              réelle depuis ses réglages.
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
    <div className="sticky top-0 z-[200] bg-indigo-600 text-white border-b border-indigo-700">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold uppercase tracking-[0.16em]">Preview</span>
          <span className="text-indigo-200">·</span>
          <span className="truncate">{entry.label}</span>
          <code className="hidden sm:inline text-indigo-200/80 font-mono ml-2">{id}</code>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-indigo-200">Données fictives</span>
          <Link
            href="/admin/templates"
            className="bg-white/15 hover:bg-white/25 rounded px-3 py-1 font-medium transition-colors"
          >
            ← Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
