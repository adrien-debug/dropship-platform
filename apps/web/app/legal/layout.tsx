import Link from 'next/link';

const NAV = [
  { href: '/legal/cgv', label: 'CGV' },
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/confidentialite', label: 'Confidentialité' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900">
            ← Retour boutique
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-zinc-500 hover:text-zinc-900 transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <article className="prose prose-zinc max-w-none">{children}</article>
      </main>
      <footer className="border-t border-zinc-200 mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-zinc-400">
          © {new Date().getFullYear()} Hearst Corporation
        </div>
      </footer>
    </div>
  );
}
