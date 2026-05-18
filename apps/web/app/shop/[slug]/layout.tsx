import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStoreBySlug, publicAnalytics } from '@/lib/store-config';
import { BrandLogo } from '@/components/ui';
import { getConsent } from '@/lib/consent';
import { StoreAnalytics } from '@/components/analytics/StoreAnalytics';
import { CookieBanner } from '@/components/analytics/CookieBanner';
import { resolveDesign } from '@/lib/design/runtime';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const consent = await getConsent();
  const design = resolveDesign(store);

  return (
    <div
      // Legacy --primary / --accent kept so older templates still resolve.
      // The locked design system uses --ds-* (see design/runtime.ts).
      style={
        {
          '--primary': design.palette.primary,
          '--accent': design.palette.accent,
          fontFamily: 'var(--ds-font-body)',
          color: 'var(--ds-text)',
          backgroundColor: 'var(--ds-bg)',
        } as React.CSSProperties
      }
    >
      {design.googleFontsUrl && (
        // The layout is a server component so the <link> ends up in <head>
        // via React's float feature. Pre-connect to keep first-paint fast.
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={design.googleFontsUrl} />
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: design.cssVars }} />
      <StoreAnalytics ids={publicAnalytics(store)} consent={consent} />
      <CookieBanner />
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link
              href={`/shop/${slug}`}
              className="hover:opacity-90 transition-opacity"
              aria-label={`${store.name} accueil`}
            >
              <BrandLogo
                name={store.name}
                accentColor={store.accentColor}
                tone="inverse"
                size="header"
              />
            </Link>
            <nav className="flex items-center gap-8 text-sm font-medium text-white">
              <Link href={`/shop/${slug}`} className="hover:opacity-75 transition-opacity uppercase tracking-wider text-xs">
                Boutique
              </Link>
              <Link href="/cart" className="hover:opacity-75 transition-opacity uppercase tracking-wider text-xs">
                Panier
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-zinc-950 text-white py-14">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4 flex flex-col items-center">
          <BrandLogo
            name={store.name}
            accentColor={store.accentColor}
            tone="inverse"
            size="footer"
          />
          {store.tagline && <p className="text-sm opacity-80">{store.tagline}</p>}
          <p className="text-xs opacity-60 max-w-md mx-auto">
            Livraison France métropolitaine sous 7 à 15 jours · Paiement sécurisé Stripe · Retour 30 jours
          </p>
          <nav className="flex items-center justify-center gap-4 text-xs opacity-70 pt-2">
            <Link href="/legal/cgv" className="hover:opacity-100 transition-opacity uppercase tracking-wider">CGV</Link>
            <span className="opacity-30">·</span>
            <Link href="/legal/mentions-legales" className="hover:opacity-100 transition-opacity uppercase tracking-wider">Mentions légales</Link>
            <span className="opacity-30">·</span>
            <Link href="/legal/confidentialite" className="hover:opacity-100 transition-opacity uppercase tracking-wider">Confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
