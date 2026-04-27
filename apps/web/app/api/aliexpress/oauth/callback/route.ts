import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();

function sign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHash('md5').update(`${APP_SECRET}${sorted}${APP_SECRET}`).digest('hex').toUpperCase();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  // Doit matcher EXACTEMENT le redirect_uri envoyé au /authorize (et déclaré dans App Console)
  const redirectUri = 'https://dropship-platform-amber.vercel.app/api/aliexpress/oauth/callback';

  const params: Record<string, string> = {
    app_key: APP_KEY,
    timestamp: Date.now().toString(),
    sign_method: 'md5',
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  params.sign = sign(params);

  const qs = new URLSearchParams(params).toString();
  const tokenUrl = `https://api-sg.aliexpress.com/rest/auth/token/create?${qs}`;
  const res = await fetch(tokenUrl, { method: 'POST' });
  const rawBody = await res.text();

  let data: {
    access_token?: string;
    refresh_token?: string;
    expire_time?: number;
    refresh_token_valid_time?: number;
    user_nick?: string;
    error_response?: { msg: string; sub_msg?: string; code?: string };
  } = {};
  try { data = JSON.parse(rawBody); } catch { /* keep rawBody for display */ }

  if (data.error_response || !data.access_token) {
    const escape = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
    return new NextResponse(
      `<html><body style="font-family:ui-monospace,monospace;padding:2rem;max-width:900px;margin:0 auto">
        <h2>❌ AliExpress OAuth Error</h2>
        <p>HTTP <strong>${res.status}</strong></p>
        <h3>Response body</h3>
        <pre style="background:#f4f4f4;padding:1rem;border-radius:6px;white-space:pre-wrap;word-break:break-all">${escape(rawBody)}</pre>
        <h3>Request (debug)</h3>
        <pre style="background:#f4f4f4;padding:1rem;border-radius:6px;white-space:pre-wrap;word-break:break-all">POST ${escape(tokenUrl.replace(APP_SECRET || 'XXX', '<secret>'))}</pre>
        <a href="/admin/settings">← Back</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 },
    );
  }

  const db = getDb();
  await db.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('aliexpress_access_token', $1, now()),
            ('aliexpress_refresh_token', $2, now()),
            ('aliexpress_token_expires', $3, now()),
            ('aliexpress_user_nick', $4, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [
      data.access_token,
      data.refresh_token || '',
      data.expire_time?.toString() || '',
      data.user_nick || '',
    ],
  );

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
      <h2>✅ AliExpress connecté !</h2>
      <p><strong>Compte :</strong> ${data.user_nick || 'inconnu'}</p>
      <p>Le token d'accès a été sauvegardé. L'agent peut maintenant chercher des produits réels.</p>
      <a href="/admin/settings" style="display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#000;color:#fff;border-radius:8px;text-decoration:none">← Retour admin</a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
}
