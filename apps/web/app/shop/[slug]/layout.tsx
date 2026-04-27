import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStoreBySlug } from '@/lib/store-config';
import { BrandLogo } from '@/components/ui';

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

  return (
    <div style={{ '--primary': store.primaryColor, '--accent': store.accentColor } as React.CSSProperties}>
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

      <main className="min-h-screen bg-white">{children}</main>

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
