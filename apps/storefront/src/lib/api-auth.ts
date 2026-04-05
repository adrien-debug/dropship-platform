import type { NextRequest } from 'next/server';
import { verifyOnepeaceSessionToken } from './session-jwt';

export async function getAuthorizedCustomerId(
  req: NextRequest,
  routeCustomerId: string,
): Promise<{ ok: true; customerId: string } | { ok: false; status: number; body: Record<string, unknown> }> {
  const auth = req.headers.get('authorization');
  const bearer =
    auth?.startsWith('Bearer ') ? auth.slice(7).trim() : req.cookies.get('shop_token')?.value ?? '';
  if (!bearer) {
    return { ok: false, status: 401, body: { error: 'Authentication required' } };
  }
  const payload = await verifyOnepeaceSessionToken(bearer);
  if (!payload || payload.sub !== routeCustomerId) {
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }
  return { ok: true, customerId: payload.sub };
}
