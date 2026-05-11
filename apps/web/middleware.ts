import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware. Three distinct responsibilities:
 *
 *  1. **Custom domain rewrite** (P1.1): if the incoming host is a merchant's
 *     custom domain (not a platform host), resolve it to a store slug via
 *     /api/domain-resolve and rewrite the path to /shop/{slug} — no redirect,
 *     the URL stays clean on the custom domain. The result is cached in a
 *     module-level Map with a 60 s TTL so only the first request per domain
 *     per cold start pays the lookup cost.
 *
 *  2. **Admin auth**: every admin surface (`/admin/*`, `/api/agent/*`, AE
 *     OAuth start, AE diagnostics, Medusa setup) sits behind HTTP Basic
 *     auth. Public exceptions (AE OAuth callback, Medusa health,
 *     domain-resolve) are explicitly carved out.
 *
 *  3. **UTM capture**: every visit to `/shop/:path*` checks for utm_*,
 *     fbclid, ttclid query params and stashes them in a 1st-party cookie
 *     so the checkout / order pipeline can attribute the conversion. No
 *     auth, no redirect — fully transparent to the visitor.
 *
 * All flows share this middleware because Next.js only allows one. The
 * matcher list maps each route bucket to the logic it should run.
 */

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? '').trim();

// Routes that share a guarded prefix but must remain public.
const PUBLIC_EXCEPTIONS = new Set<string>([
  '/api/aliexpress/oauth/callback',  // AliExpress redirects browsers here
  '/api/medusa/health',              // GH Actions warm-up + storefront health
  '/api/domain-resolve',             // P1.1: internal domain→slug lookup (no auth)
]);

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ttclid', 'gclid'] as const;
const UTM_COOKIE = 'utm_attribution';
const UTM_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---------------------------------------------------------------------------
// P1.1 — custom domain rewrite helpers
// ---------------------------------------------------------------------------

/** Module-level TTL cache: domain → { slug, expiresAt }. Empty slug = known miss. */
const domainCache = new Map<string, { slug: string; expiresAt: number }>();
const DOMAIN_CACHE_TTL_MS = 60_000;       // 60 s positive TTL
const DOMAIN_CACHE_MISS_TTL_MS = 10_000;  // 10 s negative TTL (unknown domain)

/** Hostnames / suffixes that belong to the platform itself — never custom-domain-rewrite these. */
const PLATFORM_HOSTS = new Set(['localhost', '127.0.0.1']);
const PLATFORM_HOST_SUFFIXES = ['.vercel.app', '.hearstcorporation.io', '.hearst.ai'];

function isPlatformHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase();
  if (PLATFORM_HOSTS.has(h)) return true;
  for (const suffix of PLATFORM_HOST_SUFFIXES) {
    if (h.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Resolve a custom domain to a store slug.
 * Uses a module-level cache; on miss, calls /api/domain-resolve (loopback on Vercel).
 * Returns null when the domain is unknown or the lookup fails.
 */
async function resolveCustomDomain(host: string, baseUrl: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug || null; // empty string = cached miss
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/domain-resolve?host=${encodeURIComponent(host)}`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) {
      // Cache negative result for a shorter window to avoid hammering the DB
      // for hostnames we don't know about (e.g. bots probing random vhosts).
      domainCache.set(host, { slug: '', expiresAt: Date.now() + DOMAIN_CACHE_MISS_TTL_MS });
      return null;
    }
    const { slug } = (await res.json()) as { slug: string };
    domainCache.set(host, { slug, expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS });
    return slug;
  } catch {
    // Network error or timeout — don't cache, let the next request retry.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main middleware (must be async for the domain-resolve fetch)
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const path = req.nextUrl.pathname;

  // ── 1. Custom domain rewrite ───────────────────────────────────────────
  // If the incoming host is NOT one of our platform hosts, check whether it
  // belongs to a store with a custom_domain configured. If so, transparently
  // rewrite to /shop/{slug}. The URL the visitor sees never changes.
  if (!isPlatformHost(host)) {
    const baseUrl = req.nextUrl.origin; // e.g. https://maison-chic.com
    const slug = await resolveCustomDomain(host, baseUrl);
    if (slug) {
      // Skip the rewrite when already under /shop/ (avoids double-rewrite),
      // or for Next.js internals and our own API routes.
      if (
        !path.startsWith('/shop/') &&
        !path.startsWith('/api/') &&
        !path.startsWith('/_next/')
      ) {
        const newPath = path === '/' ? `/shop/${slug}` : `/shop/${slug}${path}`;
        const url = req.nextUrl.clone();
        url.pathname = newPath;
        const res = NextResponse.rewrite(url);
        return captureUtm(req, res);
      }
    }
  }

  // ── 2. Storefront: capture UTMs, never block ───────────────────────────
  if (path.startsWith('/shop/')) {
    return captureUtm(req, NextResponse.next());
  }

  // ── 3. Admin: enforce Basic auth (with carved-out public exceptions) ───
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
    '/api/domain-resolve',
    // Storefront — UTM capture only, no auth.
    '/shop/:path*',
  ],
};
