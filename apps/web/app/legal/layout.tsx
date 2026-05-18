import Link from 'next/link';

const NAV = [
  { href: '/legal/cgv', label: 'CGV' },
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/confidentialite', label: 'Confidentialité' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      {/* Navigation bar — Cockpit-aware: uses surface tokens for dark shell */}
      <header
        className="border-b sticky top-0 z-10 backdrop-blur-sm"
        style={{
          backgroundColor: 'var(--ct-surface-1, rgba(255,255,255,0.04))',
          borderColor: 'var(--ct-border, rgba(255,255,255,0.10))',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-75"
            style={{ color: 'var(--ct-text-primary, #f5f5f5)' }}
          >
            ← Retour boutique
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:opacity-100"
                style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Legal content card — readable on dark Cockpit background */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <article
          className="ct-card prose max-w-none"
          style={{
            /* Override Tailwind prose colours so text stays readable on dark */
            '--tw-prose-body': 'var(--ct-text-body, rgba(245,245,245,0.72))',
            '--tw-prose-headings': 'var(--ct-text-strong, #ffffff)',
            '--tw-prose-lead': 'var(--ct-text-muted, rgba(245,245,245,0.48))',
            '--tw-prose-links': 'var(--ct-accent, #be123c)',
            '--tw-prose-bold': 'var(--ct-text-primary, rgba(245,245,245,0.92))',
            '--tw-prose-bullets': 'var(--ct-text-muted, rgba(245,245,245,0.48))',
            '--tw-prose-hr': 'var(--ct-border, rgba(255,255,255,0.10))',
            '--tw-prose-captions': 'var(--ct-text-faint, rgba(245,245,245,0.40))',
            '--tw-prose-code': 'var(--ct-text-primary, rgba(245,245,245,0.92))',
            '--tw-prose-th-borders': 'var(--ct-border, rgba(255,255,255,0.10))',
            '--tw-prose-td-borders': 'var(--ct-border-soft, rgba(255,255,255,0.06))',
          } as React.CSSProperties}
        >
          {children}
        </article>
      </main>

      <footer
        className="mt-10 border-t"
        style={{ borderColor: 'var(--ct-border-soft, rgba(255,255,255,0.06))' }}
      >
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs"
          style={{ color: 'var(--ct-text-faint, rgba(245,245,245,0.40))' }}
        >
          © {new Date().getFullYear()} Hearst Corporation
        </div>
      </footer>
    </div>
  );
}
