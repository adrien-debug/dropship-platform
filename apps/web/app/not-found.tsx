import Link from 'next/link';

/**
 * 404 page. Surfaced for any route the App Router can't match. Same visual
 * register as `app/error.tsx` — premium, brief, one clear way out.
 */
export default function NotFound() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6" style={{ background: 'var(--ct-bg-deep)', color: 'var(--ct-text-primary)' }}>
      <div className="max-w-md text-center">
        <p className="text-kicker uppercase tracking-kicker font-medium mb-5" style={{ color: 'var(--ct-text-muted)' }}>
          404
        </p>
        <h1 className="font-semibold tracking-tight text-4xl sm:text-5xl leading-[1.05] mb-5">
          Cette page n&apos;existe pas.
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--ct-text-body)' }}>
          Le lien est peut-&ecirc;tre p&eacute;rim&eacute;, ou nous l&apos;avons retir&eacute;. Retournez &agrave; l&apos;accueil pour continuer.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-cta transition-colors hover:-translate-y-0.5"
          style={{ background: 'var(--ct-accent)', color: 'var(--ct-text-strong)' }}
        >
          Retour
        </Link>
      </div>
    </main>
  );
}
