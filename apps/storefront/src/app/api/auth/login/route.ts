import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { loginSchema } from '@/lib/auth-schemas';
import { signOnepeaceSessionToken } from '@/lib/session-jwt';
import { findCustomerByEmail, isMissingTableError } from '@/lib/customer-repository';
import { getSiteId } from '@/lib/site-config';

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const siteId = await getSiteId();

    let customer: Record<string, unknown> | null;
    try {
      customer = await findCustomerByEmail(supabase, email, siteId) as Record<string, unknown> | null;
    } catch (err) {
      if (err instanceof Error && isMissingTableError({ message: err.message })) {
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }
      throw err;
    }

    if (!customer) {
      return NextResponse.json({ error: 'E-mail ou mot de passe incorrect' }, { status: 401 });
    }

    const hash = typeof customer.password_hash === 'string' ? customer.password_hash : '';
    if (!hash || !(await bcrypt.compare(password, hash))) {
      return NextResponse.json({ error: 'E-mail ou mot de passe incorrect' }, { status: 401 });
    }

    const token = await signOnepeaceSessionToken({
      sub: customer.id as string,
      email: customer.email as string,
      name: (customer.name as string) ?? '',
      siteId: siteId ?? undefined,
    });

    const res = NextResponse.json({
      token,
      customer: { id: customer.id, email: customer.email, name: customer.name },
    });
    res.cookies.set('shop_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    console.error('[auth/login] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
