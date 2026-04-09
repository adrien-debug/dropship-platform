import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const APP_KEY = process.env.ALIEXPRESS_APP_KEY || '531346';
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || '';
const ACCESS_TOKEN = process.env.ALIEXPRESS_ACCESS_TOKEN || '';

function signRequest(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  const concat = sorted.map(k => k + params[k]).join('');
  const baseString = APP_SECRET + concat + APP_SECRET;
  return crypto.createHash('md5').update(baseString, 'utf8').digest('hex').toUpperCase();
}

function signHmac(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  const concat = sorted.map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(concat).digest('hex').toUpperCase();
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || 'serum';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '10'), 50);

  if (!APP_SECRET) {
    return NextResponse.json({ error: 'ALIEXPRESS_APP_SECRET not configured' }, { status: 500 });
  }

  if (!ACCESS_TOKEN) {
    return NextResponse.json({
      error: 'ALIEXPRESS_ACCESS_TOKEN not set. Authorize first.',
      auth_url: `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent('http://localhost:3002/api/aliexpress/callback')}&client_id=${APP_KEY}`,
    }, { status: 401 });
  }

  const timestamp = String(Date.now());

  const params: Record<string, string> = {
    app_key: APP_KEY,
    session: ACCESS_TOKEN,
    sign_method: 'sha256',
    timestamp,
    v: '2.0',
    format: 'json',
    method: 'aliexpress.ds.product.get',
  };

  params.sign = signHmac(params);

  const qs = new URLSearchParams(params).toString();

  try {
    const res = await fetch(`https://api-sg.aliexpress.com/sync?${qs}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[AliExpress Search] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
