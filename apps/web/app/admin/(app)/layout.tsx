import Link from 'next/link';
import { AdminLogoutButton } from '../login/AdminLogoutButton';

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  /** Liens alignés sur les routes réellement présentes dans `app/admin`. */
  const navItems = [
    { href: '/admin/catalog', label: 'Catalogue', badge: 'Medusa' },
    { href: '/admin/medusa', label: 'Pré-staging', badge: 'DB' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-black text-white flex flex-col">
        <div className="p-6">
          <Link href="/admin/medusa" className="block text-xl font-bold hover:text-zinc-200">
            Dropship Admin
          </Link>
          <p className="mt-2 text-xs text-zinc-500">Navigation réduite aux écrans implémentés.</p>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block px-4 py-2 rounded transition-colors hover:bg-gray-800">
                  {item.label}
                  {item.badge ? (
                    <span className="ml-2 text-[10px] uppercase text-zinc-400">({item.badge})</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <AdminLogoutButton />
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-white p-8">{children}</main>
    </div>
  );
}
