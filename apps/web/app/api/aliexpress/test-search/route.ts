import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();

export const dynamic = 'force-dynamic';

function sign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHash('md5').update(`${APP_SECRET}${sorted}${APP_SECRET}`).digest('hex').toUpperCase();
}

async function callRaw(method: string, accessToken: string, extra: Record<string, string>) {
  const params: Record<string, string> = {
    app_key: APP_KEY,
    method,
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    access_token: accessToken,
    ...extra,
  };
  params.sign = sign(params);
  const res = await fetch(`https://api-sg.aliexpress.com/sync?${new URLSearchParams(params)}`);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  return { http: res.status, body };
}

export async function GET(req: NextRequest) {
  const keywords = req.nextUrl.searchParams.get('keywords') || 'wireless headphones';

  const db = getDb();
  const { rows } = await db.query<{ value: string }>(
    `SELECT value FROM platform_settings WHERE key = 'aliexpress_access_token'`,
  );
  const token = rows[0]?.value;
  if (!token) {
    return NextResponse.json({ error: 'No access_token in DB. Run /api/aliexpress/oauth/start first.' }, { status: 401 });
  }

  const attempts = [
    {
      name: 'aliexpress.ds.text.search',
      extra: { keyWord: keywords, local: 'en_US', countryCode: 'US', currency: 'USD', pageSize: '5', pageIndex: '1' },
    },
    {
      name: 'aliexpress.ds.recommend.feed.get',
      extra: { feed_name: 'DS bestseller', country: 'US', target_currency: 'USD', target_language: 'EN', page_size: '5', page_no: '1' },
    },
    {
      name: 'aliexpress.affiliate.product.query',
      extra: { keywords, target_currency: 'USD', target_language: 'EN', page_no: '1', page_size: '5' },
    },
  ];

  const results = [];
  for (const a of attempts) {
    try {
      results.push({ method: a.name, ...(await callRaw(a.name, token, a.extra)) });
    } catch (e) {
      results.push({ method: a.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ keywords, results }, { status: 200 });
}
