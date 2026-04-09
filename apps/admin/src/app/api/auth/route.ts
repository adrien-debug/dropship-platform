import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '@/lib/auth';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] ?? '';
const COOKIE_NAME = 'dp_session';
const TOKEN_TTL_S = 60 * 60 * 24 * 7;

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; username?: string; password?: string };
  const email = body.email ?? body.username ?? '';
  const password = body.password ?? '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[auth] SUPABASE_URL or SUPABASE_ANON_KEY not set');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      console.error('[auth] Login failed:', error?.message ?? 'no session');
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, user: data.user.email });
    res.cookies.set(COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: TOKEN_TTL_S,
    });
    return res;
  } catch (err) {
    console.error('[auth] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Auth service error' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export async function GET() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const authenticated = await verifyAdminToken(token);
  return NextResponse.json({ authenticated });
}
