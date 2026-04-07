import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSiteId } from '@/lib/site-config';

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const siteId = await getSiteId();
    const sb = createAdminClient();
    const { error } = await sb.from('contact_messages').insert({
      name,
      email,
      subject: subject ?? null,
      message,
      ...(siteId ? { site_id: siteId } : {}),
    });

    if (error) {
      console.error('[api/contact] Supabase insert failed:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/contact] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
