'use client';

/**
 * Last-resort error boundary. Catches errors thrown inside the root layout
 * itself (where a regular `error.tsx` can't help — its segment never
 * mounts). Self-contained: doesn't rely on the design system because the
 * design system might be what's broken. Inline styles only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fff',
          color: '#18181b',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#a1a1aa', margin: '0 0 20px' }}>
            Erreur
          </p>
          <h1 style={{ fontSize: '32px', lineHeight: 1.1, margin: '0 0 20px', fontWeight: 600 }}>
            Quelque chose s’est mal passé.
          </h1>
          <p style={{ fontSize: '15px', color: '#52525b', margin: '0 0 32px', lineHeight: 1.6 }}>
            Rechargez la page pour réessayer. Votre panier reste intact.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#09090b',
              color: '#fff',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '999px',
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ marginTop: '32px', fontSize: '10px', letterSpacing: '0.22em', color: '#a1a1aa', textTransform: 'uppercase' }}>
              Référence · {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
