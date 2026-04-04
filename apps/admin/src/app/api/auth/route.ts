import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const VALID_USER = 'admin';
const VALID_PASS = 'Admin';
const COOKIE_NAME = 'dp_session';
const COOKIE_VALUE = 'authenticated';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username === VALID_USER && password === VALID_PASS) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
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
  const session = store.get(COOKIE_NAME);
  return NextResponse.json({ authenticated: session?.value === COOKIE_VALUE });
}
