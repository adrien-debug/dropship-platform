import * as Sentry from '@sentry/nextjs';

/**
 * Sentry init for the browser bundle. Next 15 loads this file
 * automatically on first navigation — do not import it from a layout
 * or page yourself. Replaces the legacy `sentry.client.config.ts`.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Performance: 10% of page loads / nav transactions. Bumps later once
  // we know baseline ad-driven volume.
  tracesSampleRate: 0.1,

  // Session Replay: skip the cost of recording every session, but record
  // the 60 seconds before any error so we can see what the visitor did.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],

  // Drop high-volume noise that doesn't help diagnose real problems.
  ignoreErrors: [
    // Browser extensions throwing into the page
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
    // ResizeObserver bug surfaced by every Chrome version, not actionable
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
    // Dynamic-import retry that recovers transparently after a deploy
    /Loading chunk \d+ failed/,
    'ChunkLoadError',
    // Network blip from the user's side, not the app's bug
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'Network request failed',
  ],

  denyUrls: [
    // Vendor scripts injected by ad networks / analytics — out of our control
    /facebook\.com/,
    /facebook\.net/,
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /tiktok\.com/,
  ],

  debug: false,
  sendDefaultPii: false,
});

// Hook the App Router's transition start into Sentry's tracing so client
// navigations show up as their own transactions in the dashboard. Required
// since v10 — without it the SDK warns at boot.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
