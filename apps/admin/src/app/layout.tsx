import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dropship Platform — Admin',
  description: 'Multi-site dropshipping management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  const links = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/discover', label: 'Decouverte', icon: '🔥' },
    { href: '/sites', label: 'Sites', icon: '🌐' },
    { href: '/catalogs', label: 'Catalogues', icon: '📦' },
    { href: '/products', label: 'Produits', icon: '🛍️' },
    { href: '/orders', label: 'Commandes', icon: '📋' },
    { href: '/marketing', label: 'Marketing', icon: '📣' },
    { href: '/gpu', label: 'GPU Status', icon: '🖥️' },
    { href: '/settings', label: 'Parametres', icon: '⚙️' },
  ];

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold text-brand">Dropship Platform</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
