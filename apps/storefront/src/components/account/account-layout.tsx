'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useAccountAuth } from './account-auth-provider';

const NAV: { href: string; label: string }[] = [
  { href: '/account', label: 'Tableau de bord' },
  { href: '/account/profile', label: 'Profil' },
  { href: '/account/orders', label: 'Commandes' },
  { href: '/account/addresses', label: 'Adresses' },
];

export function AccountLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const { auth, logout } = useAccountAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:px-6 bg-[#f5f0e8]">
      <aside className="shrink-0 md:w-56 rounded-2xl border border-[#eeeeee] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#eeeeee] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#999999]">
            Compte
          </p>
          <p className="mt-1 truncate text-sm font-medium text-[#333333]">
            {auth?.email ?? '—'}
          </p>
        </div>
        <nav className="flex flex-col py-2">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/account' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'relative px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'text-[#D9312B] border-l-[3px] border-[#D9312B] bg-red-50/60'
                    : 'text-[#333333] hover:text-[#D9312B] border-l-[3px] border-transparent',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#eeeeee] p-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <section className="min-w-0 flex-1 rounded-2xl border border-[#eeeeee] bg-white p-6 shadow-sm">
        {children}
      </section>
    </div>
  );
}
