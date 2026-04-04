import type { Metadata } from 'next';
import { getSiteConfig } from '@/lib/site-config';
import { getTheme } from '@/lib/theme';
import { CartProvider } from '@/lib/cart-context';
import { CartBadge } from './cart-badge';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const siteName = (site as Record<string, unknown>).name as string || 'Store';
  return {
    title: siteName,
    description: `Boutique en ligne — ${siteName}`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig();
  const siteName = (site as Record<string, unknown>).name as string || 'Store';
  const { ds, css, fontsUrl } = getTheme();

  return (
    <html lang="fr" className={ds.darkMode ? 'dark' : ''}>
      <head>
        {fontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href={fontsUrl} rel="stylesheet" />
          </>
        )}
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body className="min-h-screen bg-[var(--ds-bg)] text-[var(--ds-text)] antialiased" style={{ fontFamily: 'var(--ds-font-primary)' }}>
        <CartProvider>
          <header className="border-b border-[var(--ds-border)]">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
              <a href="/" className="text-xl font-bold" style={{ color: 'var(--ds-accent)' }}>
                {siteName}
              </a>
              <nav className="flex items-center gap-6 text-sm">
                <a href="/shop" className="transition-colors hover:text-[var(--ds-accent)]" style={{ transition: 'var(--ds-transition)' }}>
                  Boutique
                </a>
                <a href="/cart" className="relative transition-colors hover:text-[var(--ds-accent)]" style={{ transition: 'var(--ds-transition)' }}>
                  Panier
                  <CartBadge />
                </a>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="border-t border-[var(--ds-border)] py-8 text-center text-sm text-[var(--ds-text-muted)]">
            {siteName} — Tous droits reserves
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
