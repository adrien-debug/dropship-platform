import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware. Two distinct responsibilities:
 *
 *  1. **Admin auth**: every admin surface (`/admin/*`, `/api/agent/*`, AE
 *     OAuth start, AE diagnostics, Medusa setup) sits behind HTTP Basic
 *     auth. Public exceptions (AE OAuth callback, Medusa health) are
 *     explicitly carved out.
 *
 *  2. **UTM capture**: every visit to `/shop/:path*` checks for utm_*,
 *     fbclid, ttclid query params and stashes them in a 1st-party cookie
 *     so the checkout / order pipeline can attribute the conversion. No
 *     auth, no redirect — fully transparent to the visitor.
 *
 * Both flows share this middleware because Next.js only allows one. The
 * matcher list maps each route bucket to the logic it should run.
 */

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? '').trim();

// Routes that share a guarded prefix but must remain public.
const PUBLIC_EXCEPTIONS = new Set<string>([
  '/api/aliexpress/oauth/callback',  // AliExpress redirects browsers here
  '/api/medusa/health',              // GH Actions warm-up + storefront health
]);

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ttclid'] as const;
const UTM_COOKIE = 'utm_attribution';
const UTM_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

/**
 * Read utm_* / fbclid / ttclid from the URL. If at least one is present,
 * pin them to a 1st-party cookie that lives 30 days. Last touch wins —
 * a fresh ad click overwrites any prior attribution.
 */
function captureUtm(req: NextRequest, res: NextResponse): NextResponse {
  const params = req.nextUrl.searchParams;
  const captured: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v && v.length > 0 && v.length <= 256) {
      captured[key] = v;
    }
  }
  if (Object.keys(captured).length === 0) return res;
  captured.captured_at = new Date().toISOString();

  res.cookies.set(UTM_COOKIE, JSON.stringify(captured), {
    httpOnly: false,         // The client-side pixel needs to read it for dedup.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: UTM_TTL_SECONDS,
    path: '/',
  });
  return res;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Storefront: capture UTMs, never block.
  if (path.startsWith('/shop/')) {
    return captureUtm(req, NextResponse.next());
  }

  // Admin: enforce Basic auth (with carved-out public exceptions).
  if (PUBLIC_EXCEPTIONS.has(path)) {
    return NextResponse.next();
  }
  return hasValidBasicAuth(req) ? NextResponse.next() : challenge();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/agent/:path*',
    '/api/aliexpress/oauth/start',
    '/api/aliexpress/oauth/callback',
    '/api/aliexpress/oauth/refresh',
    '/api/aliexpress/test-search',
    '/api/aliexpress/probe-order',
    '/api/medusa/setup',
    '/api/medusa/health',
    // Storefront — UTM capture only, no auth.
    '/shop/:path*',
  ],
};
