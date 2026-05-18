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
    <main className="min-h-[80vh] flex items-center justify-center px-6" style={{ background: 'var(--ct-bg-deep)', color: 'var(--ct-text-primary)' }}>
      <div className="max-w-md text-center">
        <p className="text-kicker uppercase tracking-kicker font-medium mb-5" style={{ color: 'var(--ct-text-muted)' }}>
          Erreur
        </p>
        <h1 className="font-semibold tracking-tight text-4xl sm:text-5xl leading-[1.05] mb-5">
          On vient de manquer une marche.
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--ct-text-body)' }}>
          Une erreur a interrompu le chargement de cette page. Réessayez ou retournez à l&apos;accueil — votre panier reste intact.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-cta transition-colors hover:-translate-y-0.5"
            style={{ background: 'var(--ct-accent)', color: 'var(--ct-text-strong)' }}
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-medium uppercase tracking-cta transition-colors"
            style={{ border: '1px solid var(--ct-border)', color: 'var(--ct-text-body)' }}
          >
            Retour
          </Link>
        </div>
        {error.digest && (
          <p className="mt-10 text-kicker uppercase tracking-label" style={{ color: 'var(--ct-text-muted)' }}>
            Référence · {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
