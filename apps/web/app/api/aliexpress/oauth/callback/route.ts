import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getDb } from '@/lib/db';
import { encryptSecret } from '@/lib/secrets';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();

// IOP system endpoints (/auth/token/create, /auth/token/refresh) :
// HMAC-SHA256(secret, apiPath + concat(sorted(k+v))), hex uppercase.
// Différent de /sync qui utilise MD5(secret + concat + secret).
function signSystem(apiPath: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHmac('sha256', APP_SECRET).update(`${apiPath}${sorted}`, 'utf8').digest('hex').toUpperCase();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('ae_oauth_state')?.value;

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: 'Invalid or missing state parameter — possible CSRF attack.' }, { status: 403 });
  }

  // Consume the state cookie immediately (one-time use).
  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set('ae_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
  };

  const apiPath = '/auth/token/create';
  const params: Record<string, string> = {
    app_key: APP_KEY,
    code,
    sign_method: 'sha256',
    timestamp: Date.now().toString(),
  };
  params.sign = signSystem(apiPath, params);

  const qs = new URLSearchParams(params).toString();
  const tokenUrl = `https://api-sg.aliexpress.com/rest/auth/token/create?${qs}`;
  const res = await fetch(tokenUrl, { method: 'POST', signal: AbortSignal.timeout(15_000) });
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
    const errorRes = new NextResponse(
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
    clearStateCookie(errorRes);
    return errorRes;
  }

  const db = getDb();
  const encAccess = encryptSecret(data.access_token);
  const encRefresh = data.refresh_token ? encryptSecret(data.refresh_token) : null;
  await db.query(
    `INSERT INTO platform_settings (key, value, value_enc, value_nonce, updated_at)
     VALUES ('aliexpress_access_token', NULL, $1, $2, now()),
            ('aliexpress_refresh_token', NULL, $3, $4, now()),
            ('aliexpress_token_expires', $5, NULL, NULL, now()),
            ('aliexpress_user_nick', $6, NULL, NULL, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_enc = EXCLUDED.value_enc, value_nonce = EXCLUDED.value_nonce, updated_at = now()`,
    [
      encAccess.encrypted,
      encAccess.nonce,
      encRefresh ? encRefresh.encrypted : null,
      encRefresh ? encRefresh.nonce : null,
      data.expire_time?.toString() || '',
      data.user_nick || '',
    ],
  );

  const successRes = new NextResponse(
    `<html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
      <h2>✅ AliExpress connecté !</h2>
      <p><strong>Compte :</strong> ${data.user_nick || 'inconnu'}</p>
      <p>Le token d'accès a été sauvegardé. L'agent peut maintenant chercher des produits réels.</p>
      <a href="/admin/settings" style="display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#000;color:#fff;border-radius:8px;text-decoration:none">← Retour admin</a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
  clearStateCookie(successRes);
  return successRes;
}
