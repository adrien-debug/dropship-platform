import * as Sentry from '@sentry/nextjs';

/**
 * Sentry config for the Node.js server runtime (Route Handlers, RSC,
 * Server Actions). Loaded by `instrumentation.ts` when NEXT_RUNTIME
 * resolves to "nodejs". Mirrors `sentry.edge.config.ts` minus the
 * Node-only integrations.
 */

// Routes where we want 100% trace capture: anything that touches money or
// external fulfillment. Volume on these is low (orders, agent runs) so the
// quota impact is bounded, and a missing trace on these would mean we can't
// debug a lost €. Background quota stays at 10% on every other route.
const CRITICAL_ROUTE_PATTERNS: RegExp[] = [
  /\/api\/checkout\/complete/,
  /\/api\/agent\/orders\/[^/]+\/forward/,
  /\/api\/agent\/orders\/[^/]+\/mark-paid/,
  /\/api\/agent\/orders\/dry-run-pending/,
  /\/api\/agent\/create-store/,
  /\/api\/stripe\/webhook/,
];

function isCriticalRoute(url: string | undefined): boolean {
  if (!url) return false;
  return CRITICAL_ROUTE_PATTERNS.some((re) => re.test(url));
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Per-transaction sampling: 1.0 on money / fulfillment routes, 0.1 elsewhere.
  // tracesSampleRate is kept as a fallback for transactions without a usable
  // context (Sentry SDK requires one of the two to be set).
  tracesSampleRate: 0.1,
  tracesSampler: (ctx) => {
    const url =
      (ctx.attributes && (ctx.attributes['http.url'] || ctx.attributes['url.path'])) ||
      // `request` is populated for HTTP transactions started by the Next.js SDK.
      // It's typed as `unknown` in v8+ so we narrow defensively.
      (ctx as unknown as { request?: { url?: string } }).request?.url ||
      ctx.name;
    if (typeof url === 'string' && isCriticalRoute(url)) return 1.0;
    if (typeof ctx.name === 'string' && isCriticalRoute(ctx.name)) return 1.0;
    return 0.1;
  },

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
