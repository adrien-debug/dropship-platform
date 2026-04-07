import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const VALID_USER = process.env['ADMIN_AUTH_USER'] ?? '';
const VALID_PASS = process.env['ADMIN_AUTH_PASS'] ?? '';
const SESSION_SECRET = process.env['NEXTAUTH_SECRET'] ?? process.env['ONEPEACE_JWT_SECRET'] ?? '';
const COOKIE_NAME = 'dp_session';
const TOKEN_TTL_S = 60 * 60 * 24 * 7; // 7 days

function signToken(user: string): string {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_S;
  const payload = `${user}:${expires}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !SESSION_SECRET) return false;
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const [user, expiresStr, sig] = parts;
  const expires = parseInt(expiresStr ?? '0', 10);
  if (Date.now() / 1000 > expires) return false;
  const payload = `${user}:${expiresStr}`;
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig ?? '', 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { username?: string; password?: string };
  const { username, password } = body;

  if (!VALID_USER || !VALID_PASS) {
    console.error('[auth] ADMIN_AUTH_USER or ADMIN_AUTH_PASS not set');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  if (!SESSION_SECRET) {
    console.error('[auth] NEXTAUTH_SECRET not set — session signing disabled');
    return NextResponse.json({ error: 'Session secret not configured' }, { status: 503 });
  }

  if (username === VALID_USER && password === VALID_PASS) {
    const token = signToken(VALID_USER);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: TOKEN_TTL_S,
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export async function GET() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: verifyAdminToken(token) });
}
