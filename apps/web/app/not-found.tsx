import Link from 'next/link';

/**
 * 404 page. Surfaced for any route the App Router can't match. Same visual
 * register as `app/error.tsx` — premium, brief, one clear way out.
 */
export default function NotFound() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6 bg-white text-zinc-900">
      <div className="max-w-md text-center">
        <p className="text-kicker uppercase tracking-kicker text-zinc-400 font-medium mb-5">
          404
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-5">
          Cette page n’existe pas.
        </h1>
        <p className="text-base text-zinc-600 leading-relaxed mb-10">
          Le lien est peut-être périmé, ou nous l’avons retiré. Retournez à l’accueil pour continuer.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-zinc-950 text-white px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-cta transition-colors hover:-translate-y-0.5 hover:bg-black"
        >
          Retour
        </Link>
      </div>
    </main>
  );
}
