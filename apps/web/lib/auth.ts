/**
 * Server-side HTTP Basic auth helper.
 *
 * Defense-in-depth complement to the edge middleware (`apps/web/middleware.ts`)
 * which already protects `/admin/*` and `/api/agent/*`. This helper is intended
 * to be called at the top of sensitive route handlers so an accidental matcher
 * regression in the middleware cannot expose the route.
 *
 * Node runtime only — uses `Buffer.from`. Do not call from an edge route
 * handler (the middleware itself uses `atob` for that reason).
 */
export function verifyAdminAuth(request: Request): boolean {
  // Mirror the middleware's local-dev bypass so adding this guard does not
  // break `next dev`. `VERCEL_ENV` is set by Vercel even when NODE_ENV is
  // forced to "development", so this stays safe in production.
  const isLocalDev =
    process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production';
  if (isLocalDev) return true;

  const expectedUser = (process.env.ADMIN_USERNAME ?? '').trim();
  const expectedPass = (process.env.ADMIN_PASSWORD ?? '').trim();
  // Fail closed: missing env → reject. Mirrors the middleware policy.
  if (!expectedUser || !expectedPass) return false;

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return user === expectedUser && pass === expectedPass;
}
