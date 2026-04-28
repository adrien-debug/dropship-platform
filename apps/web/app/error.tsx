'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

/**
 * Route-level error boundary. Caught by Next.js whenever a server or client
 * render in this segment throws. Stays minimal on purpose — the visitor
 * came from a paid ad, the moment they see an error we want them to either
 * retry or get back to the store, not read a stack trace.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6 bg-white text-zinc-900">
      <div className="max-w-md text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-medium mb-5">
          Erreur
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-5">
          On vient de manquer une marche.
        </h1>
        <p className="text-base text-zinc-600 leading-relaxed mb-10">
          Une erreur a interrompu le chargement de cette page. Réessayez ou retournez à l&apos;accueil — votre panier reste intact.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center bg-zinc-950 text-white px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-[0.18em] transition-colors hover:-translate-y-0.5 hover:bg-black"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-zinc-200 text-zinc-900 px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-[0.18em] transition-colors hover:bg-zinc-50"
          >
            Retour
          </Link>
        </div>
        {error.digest && (
          <p className="mt-10 text-[10px] uppercase tracking-[0.22em] text-zinc-400">
            Référence · {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
