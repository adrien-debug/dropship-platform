import * as Sentry from '@sentry/nextjs';

/**
 * Sentry config for the Node.js server runtime (Route Handlers, RSC,
 * Server Actions). Loaded by `instrumentation.ts` when NEXT_RUNTIME
 * resolves to "nodejs". Mirrors `sentry.edge.config.ts` minus the
 * Node-only integrations.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Performance: capture 10% of transactions to stay inside the free
  // quota during the first ad burst. Bump once we know baseline volume.
  tracesSampleRate: 0.1,

  // Strip the SDK's own logger from prod bundles (smaller, less noise).
  debug: false,

  // Don't double-send PII unless explicitly enabled in a route.
  sendDefaultPii: false,

  ignoreErrors: [
    // Cart cookie races and Medusa transient blips are surfaced via the
    // app's own logging — they're not actionable in Sentry.
    /No cart/,
    /AbortError/,
  ],
});
