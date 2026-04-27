import Link from 'next/link';
import { CartIndicator } from './CartIndicator';
import type { StoreConfig } from '@/lib/store-config';

interface Props {
  children: React.ReactNode;
  /** Optional merchant store. When provided, header/footer use the store's
   *  branding and the "Boutique" link points back to /shop/{slug}. */
  store?: StoreConfig | null;
}

export function StoreShell({ children, store }: Props) {
  const homeHref = store ? `/shop/${store.slug}` : '/';
  const boutiqueHref = store ? `/shop/${store.slug}` : '/products';

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 shadow-sm"
        style={{
          backgroundColor: store?.primaryColor ?? '#ffffff',
          color: store ? '#ffffff' : '#111827',
          borderBottom: store ? 'none' : '1px solid #e4e4e7',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {store ? (
              <>
                <span className="text-3xl">{store.logoEmoji}</span>
                <div>
                  <div className="font-bold text-lg leading-tight">{store.name}</div>
                  {store.tagline && (
                    <div className="text-xs opacity-75 leading-tight">{store.tagline}</div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-lg font-semibold tracking-tight">Dropship Store</span>
            )}
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href={boutiqueHref} className="hover:opacity-75 transition-opacity">
              Boutique
            </Link>
            <CartIndicator />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        style={{
          backgroundColor: store?.primaryColor ?? '#ffffff',
          color: store ? '#ffffff' : '#52525b',
          borderTop: store ? 'none' : '1px solid #e4e4e7',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm flex flex-wrap items-center justify-between gap-3">
          <p className={store ? 'opacity-75' : ''}>
            © {new Date().getFullYear()} {store?.name ?? 'Hearst Corporation'}
          </p>
          <nav className={`flex items-center gap-4 text-xs ${store ? 'opacity-75' : ''}`}>
            <Link href="/legal/cgv" className="hover:opacity-100 transition-opacity">CGV</Link>
            <Link href="/legal/mentions-legales" className="hover:opacity-100 transition-opacity">Mentions légales</Link>
            <Link href="/legal/confidentialite" className="hover:opacity-100 transition-opacity">Confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
