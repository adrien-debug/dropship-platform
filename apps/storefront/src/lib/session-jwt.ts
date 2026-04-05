import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

export interface SessionTokenPayload {
  sub: string;
  email: string;
  name: string;
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
    if (!sub || !email) return null;
    return { sub, email, name };
  } catch {
    return null;
  }
}
