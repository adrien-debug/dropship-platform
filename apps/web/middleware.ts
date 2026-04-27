import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware that locks down every admin surface behind HTTP Basic auth.
 *
 * Why: until now anyone who guessed the URLs could DELETE a store, place a
 * real AliExpress order, or list every paid Medusa order. With ADMIN_USERNAME
 * / ADMIN_PASSWORD set, the browser handles the prompt natively and any
 * unauthenticated request — page or API — gets a 401.
 *
 * Public routes that look admin-shaped (the AE OAuth callback, Stripe webhook,
 * Medusa health probe) are explicitly carved out below so the relevant external
 * services keep working.
 */

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? '').trim();

// Routes that share a guarded prefix but must remain public.
const PUBLIC_EXCEPTIONS = new Set<string>([
  '/api/aliexpress/oauth/callback',  // AliExpress redirects browsers here
  '/api/medusa/health',              // GH Actions warm-up + storefront health
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function hasValidBasicAuth(req: NextRequest): boolean {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    // Fail closed: if env vars aren't set, deny access. Better than accidentally
    // shipping an open admin to prod.
    return false;
  }
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return timingSafeEqual(user, ADMIN_USERNAME) && timingSafeEqual(pass, ADMIN_PASSWORD);
}

function challenge(): NextResponse {
  return new NextResponse('Authorization required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Dropship Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export function middleware(req: NextRequest) {
  if (PUBLIC_EXCEPTIONS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return hasValidBasicAuth(req) ? NextResponse.next() : challenge();
}

// All paths below require Basic auth. Public storefront, cart, checkout,
// products, legal, stripe webhook, AE OAuth callback, Medusa health, and
// /shop/[slug] never enter this matcher and stay open.
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/agent/:path*',
    '/api/aliexpress/oauth/start',
    '/api/aliexpress/oauth/callback',
    '/api/aliexpress/test-search',
    '/api/aliexpress/probe-order',
    '/api/medusa/setup',
    '/api/medusa/health',
  ],
};
