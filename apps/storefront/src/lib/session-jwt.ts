import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

export interface SessionTokenPayload {
  sub: string;
  email: string;
  name: string;
  siteId?: string;
}

export async function signOnepeaceSessionToken(payload: SessionTokenPayload): Promise<string> {
  const secret = process.env.ONEPEACE_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('ONEPEACE_JWT_SECRET must be set (min 16 characters)');
  }
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    ...(payload.siteId ? { site_id: payload.siteId } : {}),
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

/** Verifies JWT issued by `signOnepeaceSessionToken` (same secret as login/register). */
export async function verifyOnepeaceSessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const secret = process.env.ONEPEACE_JWT_SECRET;
    if (!secret || secret.length < 16) return null;
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const name = typeof payload.name === 'string' ? payload.name : '';
    const siteId = typeof payload.site_id === 'string' ? payload.site_id : undefined;
    if (!sub || !email) return null;
    return { sub, email, name, siteId };
  } catch {
    return null;
  }
}
