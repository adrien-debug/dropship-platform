import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStoreBySlug } from '@/lib/store-config';

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
      <header
        style={{ backgroundColor: store.primaryColor }}
        className="text-white sticky top-0 z-50 shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={`/shop/${slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="text-3xl">{store.logoEmoji}</span>
              <div>
                <div className="font-bold text-lg leading-tight">{store.name}</div>
                {store.tagline && (
                  <div className="text-xs opacity-75 leading-tight">{store.tagline}</div>
                )}
              </div>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href={`/shop/${slug}`} className="hover:opacity-75 transition-opacity">
                Boutique
              </Link>
              <Link href="/cart" className="hover:opacity-75 transition-opacity">
                Panier
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-gray-50">{children}</main>

      <footer style={{ backgroundColor: store.primaryColor }} className="text-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm opacity-75">
            {store.logoEmoji} {store.name} — {store.tagline}
          </p>
          <p className="text-xs opacity-50 mt-2">Livraison internationale · Paiement sécurisé</p>
        </div>
      </footer>
    </div>
  );
}
