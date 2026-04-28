import * as Sentry from '@sentry/nextjs';

/**
 * Sentry config for the Edge runtime (middleware.ts and any route with
 * `export const runtime = "edge"`). Loaded by `instrumentation.ts` when
 * NEXT_RUNTIME resolves to "edge". Lightweight — no Node-only modules.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  debug: false,
  sendDefaultPii: false,
});
