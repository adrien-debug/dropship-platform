import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSiteId } from '@/lib/site-config';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }

    const siteId = await getSiteId();
    const sb = createAdminClient();
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await sb.from('newsletter_subscribers')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('site_id', siteId ?? '')
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await sb.from('newsletter_subscribers').insert({
      email: normalizedEmail,
      ...(siteId ? { site_id: siteId } : {}),
    });

    if (error) {
      console.error('[api/newsletter] Supabase upsert failed:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/newsletter] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
