import Link from 'next/link';
import { CartIndicator } from './CartIndicator';

export function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Dropship Store
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/products" className="hover:underline">Boutique</Link>
            <CartIndicator />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-zinc-500 flex flex-wrap items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Hearst Corporation</p>
          <nav className="flex items-center gap-4 text-xs">
            <Link href="/legal/cgv" className="hover:text-zinc-900 transition-colors">CGV</Link>
            <Link href="/legal/mentions-legales" className="hover:text-zinc-900 transition-colors">Mentions légales</Link>
            <Link href="/legal/confidentialite" className="hover:text-zinc-900 transition-colors">Confidentialité</Link>
            <Link href="/admin/stores" className="hover:text-zinc-900 transition-colors">Admin</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
