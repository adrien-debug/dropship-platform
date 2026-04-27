import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';

/**
 * Probe whether the AliExpress DS Order permission group is activated for our app.
 *
 * Each method is called with a deliberately invalid payload — we don't want to place
 * a real order. The signal we care about is the *kind* of error returned:
 *   - "IsvAccessLimited" / "permission" / code 27 → perm not granted
 *   - "MissingRequiredParam" / "InvalidProductId" / "PRODUCT_NOT_FOUND" → perm granted, payload rejected
 *
 * Hit GET /api/aliexpress/probe-order from the deployed app to read the verdict.
 */

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();

export const dynamic = 'force-dynamic';

function sign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign')
    .sort()
    .map((k) => `${k}${params[k]}`)
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
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { http: res.status, body };
}

export async function GET() {
  const { rows } = await getDb().query<{ value: string }>(
    `SELECT value FROM platform_settings WHERE key = 'aliexpress_access_token'`,
  );
  const token = rows[0]?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'No access_token in DB. Run /api/aliexpress/oauth/start first.' },
      { status: 401 },
    );
  }

  const probes: Array<{ name: string; extra: Record<string, string>; note: string }> = [
    {
      name: 'aliexpress.ds.order.create',
      note: 'Place a dropshipping order. Empty payload should give a validation error if the perm is granted, an access error otherwise.',
      extra: {
        param_place_order_request4_open_api_d_t_o: JSON.stringify({
          logistics_address: {},
          product_items: [],
        }),
      },
    },
    {
      name: 'aliexpress.ds.order.get',
      note: 'Look up an order by id. Bogus order_id; the kind of error tells us if we can read orders.',
      extra: { order_id: '0' },
    },
    {
      name: 'aliexpress.logistics.redefining.listlogisticsservice',
      note: 'List shipping services. Bogus product_id to keep it cheap.',
      extra: { product_id: '0', country_code: 'FR' },
    },
    {
      name: 'aliexpress.ds.recommend.feed.get',
      note: 'Sanity check that the token still works — this perm we already have.',
      extra: { feed_name: 'DS bestseller', country: 'FR', target_currency: 'EUR', target_language: 'FR', page_size: '1', page_no: '1' },
    },
  ];

  const results = [];
  for (const p of probes) {
    try {
      const out = await callRaw(p.name, token, p.extra);
      results.push({ method: p.name, note: p.note, ...out });
    } catch (e) {
      results.push({ method: p.name, note: p.note, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ results }, { status: 200 });
}
