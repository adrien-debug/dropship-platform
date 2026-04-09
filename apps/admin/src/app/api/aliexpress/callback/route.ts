import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { appendFileSync } from 'fs';
import { join } from 'path';

const APP_KEY = process.env.ALIEXPRESS_APP_KEY || '531346';
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || '';

function signHmacSha256(params: Record<string, string>, apiPath: string): string {
  const sorted = Object.keys(params).sort();
  const concat = apiPath + sorted.map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(concat).digest('hex').toUpperCase();
}

function signMd5(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  const concat = sorted.map(k => k + params[k]).join('');
  return crypto.createHash('md5').update(APP_SECRET + concat + APP_SECRET, 'utf8').digest('hex').toUpperCase();
}

async function tryTokenExchange(code: string) {
  const apiPath = '/auth/token/create';
  const timestamp = String(Date.now());

  const attempts = [
    {
      label: 'hmac-sha256 /rest path',
      fn: () => {
        const params: Record<string, string> = {
          app_key: APP_KEY, sign_method: 'sha256', timestamp, code,
          simplify: 'true', format: 'json',
        };
        params.sign = signHmacSha256(params, apiPath);
        const qs = new URLSearchParams(params).toString();
        return fetch(`https://api-sg.aliexpress.com/rest${apiPath}?${qs}`, {
          method: 'POST', signal: AbortSignal.timeout(10_000),
        });
      },
    },
    {
      label: 'hmac-sha256 /rest body+method',
      fn: () => {
        const params: Record<string, string> = {
          app_key: APP_KEY, sign_method: 'sha256', timestamp: String(Date.now()),
          code, method: apiPath, simplify: 'true', format: 'json',
        };
        const forSign = { ...params };
        delete (forSign as Record<string, string | undefined>).method;
        const sign = signHmacSha256(forSign, apiPath);
        return fetch('https://api-sg.aliexpress.com/rest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
          body: new URLSearchParams({ ...params, sign }),
          signal: AbortSignal.timeout(10_000),
        });
      },
    },
    {
      label: 'md5 /rest body+method',
      fn: () => {
        const params: Record<string, string> = {
          app_key: APP_KEY, sign_method: 'md5', timestamp: String(Date.now()),
          v: '2.0', format: 'json', method: apiPath, code,
        };
        params.sign = signMd5(params);
        return fetch('https://api-sg.aliexpress.com/rest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
          body: new URLSearchParams(params),
          signal: AbortSignal.timeout(10_000),
        });
      },
    },
    {
      label: 'hmac-sha256 /sync method',
      fn: () => {
        const params: Record<string, string> = {
          app_key: APP_KEY, sign_method: 'sha256', timestamp: String(Date.now()),
          code, method: apiPath, simplify: 'true', format: 'json',
        };
        const sign = signHmacSha256(
          Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'method')),
          apiPath,
        );
        const qs = new URLSearchParams({ ...params, sign }).toString();
        return fetch(`https://api-sg.aliexpress.com/sync?${qs}`, {
          method: 'POST', signal: AbortSignal.timeout(10_000),
        });
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const res = await attempt.fn();
      const data = await res.json();
      console.log(`[AliExpress] ${attempt.label} ->`, JSON.stringify(data).slice(0, 200));
      if (data.access_token) return data;
      if (data.code !== 'IncompleteSignature' && data.type !== 'ISV') return data;
    } catch (e) {
      console.error(`[AliExpress] ${attempt.label} error:`, e);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  if (!APP_SECRET) {
    return NextResponse.json({ error: 'ALIEXPRESS_APP_SECRET not configured' }, { status: 500 });
  }

  console.log('[AliExpress] Received auth code:', code.slice(0, 10) + '...');

  const data = await tryTokenExchange(code);

  if (!data) {
    return NextResponse.json({ error: 'All token exchange attempts failed' }, { status: 500 });
  }

  if (data.access_token) {
    console.log('[AliExpress] Token obtained successfully');

    const envLine = `\nALIEXPRESS_ACCESS_TOKEN=${data.access_token}\nALIEXPRESS_REFRESH_TOKEN=${data.refresh_token || ''}\n`;
    try {
      const envPath = join(process.cwd(), '.env.local');
      appendFileSync(envPath, envLine);
      console.log('[AliExpress] Token saved to .env.local');
    } catch {
      console.log('[AliExpress] Could not auto-save token to .env.local');
    }

    return new NextResponse(
      `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>AliExpress Connected</title></head>
      <body style="font-family:system-ui;padding:2rem;max-width:600px;margin:0 auto">
        <h2 style="color:#22c55e">&#10003; AliExpress connecté !</h2>
        <p>Access token obtenu avec succès.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:4px 8px;font-weight:bold">Expire</td><td>${data.expire_time || 'N/A'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold">User</td><td>${data.user_nick || data.user_id || 'N/A'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:bold">Country</td><td>${data.locale || 'N/A'}</td></tr>
        </table>
        <p style="margin-top:1rem">Token sauvegardé dans <code>.env.local</code>.</p>
        <p><a href="/products" style="color:#3b82f6">&#8592; Retour aux produits</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  return NextResponse.json({
    error: 'Token exchange returned unexpected response',
    details: data,
  }, { status: 400 });
}
