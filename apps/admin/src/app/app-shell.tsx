'use client';

import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/discover', label: 'Decouverte', icon: '🔥' },
  { href: '/sites', label: 'Sites', icon: '🌐' },
  { href: '/catalogs', label: 'Catalogues', icon: '📦' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/agents', label: 'Agent IA', icon: '🤖' },
  { href: '/gpu', label: 'GPU Status', icon: '🖥️' },
  { href: '/settings', label: 'Parametres', icon: '⚙️' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar pathname={pathname} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold text-brand">Dropship Platform</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV_LINKS.map(link => (
          <a
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              pathname === link.href
                ? 'bg-gray-100 font-medium text-gray-900'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
      <div className="border-t p-4">
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          Deconnexion
        </button>
      </div>
    </aside>
  );
}
