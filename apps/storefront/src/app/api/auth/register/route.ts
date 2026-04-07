import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { registerSchema } from '@/lib/auth-schemas';
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
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const siteId = await getSiteId();

    let existing: unknown;
    try {
      existing = await findCustomerByEmail(supabase, email, siteId);
    } catch (err) {
      if (err instanceof Error && isMissingTableError({ message: err.message })) {
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }
      throw err;
    }

    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet e-mail' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: inserted, error: insertErr } = await supabase
      .from('clawd_crm_customers')
      .insert({
        email: email.trim().toLowerCase(),
        name,
        password_hash: passwordHash,
        signup_at: new Date().toISOString(),
        ...(siteId ? { site_id: siteId } : {}),
      })
      .select('id, email, name')
      .single();

    if (insertErr) {
      if (isMissingTableError(insertErr)) {
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }
      console.error('[auth/register] Insert error:', insertErr.message);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    const token = await signOnepeaceSessionToken({
      sub: inserted.id,
      email: inserted.email,
      name: inserted.name ?? '',
      siteId: siteId ?? undefined,
    });

    const res = NextResponse.json({
      token,
      customer: { id: inserted.id, email: inserted.email, name: inserted.name },
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
    console.error('[auth/register] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
