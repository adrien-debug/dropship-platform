import type { Metadata } from 'next';
import { getSiteConfig } from '@/lib/site-config';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  return {
    title: (site as Record<string, unknown>).name as string || 'Store',
    description: `Boutique en ligne — ${(site as Record<string, unknown>).name}`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig();
  const siteName = (site as Record<string, unknown>).name as string || 'Store';

  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <a href="/" className="text-xl font-bold">{siteName}</a>
            <nav className="flex items-center gap-6 text-sm">
              <a href="/shop" className="hover:text-gray-600">Boutique</a>
              <a href="/cart" className="hover:text-gray-600">Panier</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t py-8 text-center text-sm text-gray-500">
          {siteName} — Tous droits reserves
        </footer>
      </body>
    </html>
  );
}
