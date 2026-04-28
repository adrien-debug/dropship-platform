/**
 * Next.js instrumentation hook. Loaded once per server worker, before any
 * request is handled. Routes the Sentry init to the right config file
 * based on the active runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js looks up the `onRequestError` hook by name; @sentry/nextjs v10
// renamed the underlying function to `captureRequestError`. The re-export
// keeps the framework hook wired without us having to maintain the bridge.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
