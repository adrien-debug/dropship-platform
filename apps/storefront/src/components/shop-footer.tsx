import Link from 'next/link';

function SocialXIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-7.08 8.1L22 22h-6.558l-4.848-6.692L5.22 22H2.2l7.56-8.615L2 2h6.558l4.384 6.05L18.244 2zm-1.08 18h1.84L7.84 4.2H5.96l11.204 15.8z" />
    </svg>
  );
}

function SocialGitHubIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function SocialYouTubeIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 33.5 12 33.5 12a33.5 33.5 0 002.1 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1 33.5 33.5 0 002.1-5.8 33.5 33.5 0 00-2.1-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

const FOOTER_COLUMNS: readonly {
  title: string;
  links: readonly { href: string; label: string }[];
}[] = [
  {
    title: 'Shop',
    links: [
      { href: '#featured', label: 'Featured' },
      { href: '#categories', label: 'Categories' },
      { href: '#new-arrivals', label: 'New Arrivals' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '#', label: 'Shipping' },
      { href: '#', label: 'Returns' },
      { href: '#', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '#', label: 'Privacy' },
      { href: '#', label: 'Terms' },
      { href: '#', label: 'Cookies' },
    ],
  },
];

export function ShopFooter(): React.JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-op-brand/15 bg-op-ink text-op-cream">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-display text-2xl tracking-wide">One Peace</p>
            <p className="mt-3 max-w-md text-sm text-op-cream/80">
              Official-inspired gear for crews who sail their own sea. Quality prints, collectibles, and everyday
              essentials — shipped with care.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://example.com"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-cream/20 text-op-cream transition hover:border-op-brand hover:text-op-brand"
                aria-label="One Peace on X"
              >
                <SocialXIcon className="h-4 w-4" />
              </a>
              <a
                href="https://example.com"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-cream/20 text-op-cream transition hover:border-op-brand hover:text-op-brand"
                aria-label="One Peace on GitHub"
              >
                <SocialGitHubIcon className="h-4 w-4" />
              </a>
              <a
                href="https://example.com"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-op-cream/20 text-op-cream transition hover:border-op-brand hover:text-op-brand"
                aria-label="One Peace on YouTube"
              >
                <SocialYouTubeIcon className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-op-cream/70">{col.title}</h2>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-op-cream/90 transition hover:text-op-brand"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-op-cream/10 pt-8 text-xs text-op-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} One Peace Shop. All rights reserved.
          </p>
          <p className="text-op-cream/50">Grand Line Commerce LLC — demo storefront</p>
        </div>
      </div>
    </footer>
  );
}
