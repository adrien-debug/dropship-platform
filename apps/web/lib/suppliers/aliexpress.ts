/**
 * AliExpress Open Platform — DS API client
 * App: Hearstai | AppKey: 531346 | Category: Drop Shipping
 *
 * Auth: OAuth access_token obtained via /api/aliexpress/oauth/start.
 * Search: `aliexpress.ds.text.search` (requires access_token).
 */

import { createHash, createHmac } from 'crypto';
import { getDb } from '@/lib/db';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();
const API_BASE = 'https://api-sg.aliexpress.com/sync';
const REST_BASE = 'https://api-sg.aliexpress.com/rest';

interface AliExpressProduct {
  product_id: string;
  product_title: string;
  product_main_image_url: string;
  product_video_url?: string;
  original_price: string;
  sale_price: string;
  discount: string;
  shop_id: string;
  shop_url: string;
  product_url: string;
  category_id: string;
  category_name: string;
  evaluate_rate: string;
  thirty_days_sold_count: string;
}

interface AliExpressSearchResult {
  current_page_no: number;
  current_record_count: number;
  total_record_count: number;
  products: AliExpressProduct[];
}

// /sync (TOP gateway): MD5(secret + concat(sorted(k+v)) + secret), uppercase.
function generateSignature(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHash('md5').update(`${APP_SECRET}${sorted}${APP_SECRET}`).digest('hex').toUpperCase();
}

// /rest/auth/token/{create,refresh} (IOP system): HMAC-SHA256(secret, apiPath + concat(sorted(k+v))), hex uppercase.
function signSystem(apiPath: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHmac('sha256', APP_SECRET).update(`${apiPath}${sorted}`, 'utf8').digest('hex').toUpperCase();
}

async function getAccessToken(): Promise<string | null> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ key: string; value: string; updated_at: Date }>(
      `SELECT key, value, updated_at FROM platform_settings WHERE key IN ('aliexpress_access_token','aliexpress_refresh_token','aliexpress_token_expires') ORDER BY key`,
    );

    const settings = Object.fromEntries(rows.map(r => [r.key, r]));
    const tokenRow = settings['aliexpress_access_token'];
    if (!tokenRow?.value) return null;

    const expiresStr = settings['aliexpress_token_expires']?.value;
    const expires = expiresStr ? parseInt(expiresStr) : 0;

    // Token still valid (with 5-min buffer)
    if (expires === 0 || Date.now() < expires - 300_000) {
      return tokenRow.value;
    }

    // Try to refresh
    const refreshToken = settings['aliexpress_refresh_token']?.value;
    if (!refreshToken) return null;

    const refreshed = await refreshAccessToken(refreshToken);
    return refreshed;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const result = await refreshAccessTokenDetailed(refreshToken);
  return result.ok && result.access_token ? result.access_token : null;
}

/**
 * Refresh result with structured detail. Used by the QW7 cron endpoint
 * (`/api/aliexpress/oauth/refresh`) to surface a clear status to GH Actions
 * and to Sentry. On success we persist the new access token + expiry (and
 * the new refresh token if AE rotated it).
 */
interface AliExpressRefreshResult {
  ok: boolean;
  access_token?: string;
  expires_at?: number;        // epoch ms (mirrors `aliexpress_token_expires`)
  rotated_refresh?: boolean;  // true if AE returned a new refresh_token
  http_status?: number;
  error?: string;
  raw?: unknown;
}

export async function refreshAccessTokenDetailed(refreshToken: string): Promise<AliExpressRefreshResult> {
  if (!APP_KEY || !APP_SECRET) {
    return { ok: false, error: 'AliExpress credentials not configured' };
  }
  try {
    const apiPath = '/auth/token/refresh';
    const params: Record<string, string> = {
      app_key: APP_KEY,
      refresh_token: refreshToken,
      sign_method: 'sha256',
      timestamp: Date.now().toString(),
    };
    params.sign = signSystem(apiPath, params);

    const res = await fetch(`${REST_BASE}${apiPath}?${new URLSearchParams(params)}`, { method: 'POST' });
    const rawBody = await res.text();
    let data: {
      access_token?: string;
      expire_time?: number;
      refresh_token?: string;
      error_response?: { msg?: string; sub_msg?: string; code?: string };
    } = {};
    try { data = JSON.parse(rawBody); } catch { /* leave empty, fall through */ }

    if (!data.access_token) {
      const errCode = data.error_response?.code || 'no_access_token';
      const errMsg = data.error_response?.sub_msg || data.error_response?.msg || rawBody.slice(0, 200);
      return { ok: false, http_status: res.status, error: `${errCode} — ${errMsg}`, raw: data };
    }

    const db = getDb();
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('aliexpress_access_token', $1, now()),
              ('aliexpress_token_expires', $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [data.access_token, data.expire_time?.toString() || ''],
    );
    const rotated = Boolean(data.refresh_token);
    if (rotated) {
      await db.query(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES ('aliexpress_refresh_token', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [data.refresh_token],
      );
    }

    return {
      ok: true,
      access_token: data.access_token,
      expires_at: data.expire_time,
      rotated_refresh: rotated,
      http_status: res.status,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown refresh error' };
  }
}

async function callApi<T>(method: string, extraParams: Record<string, string>, accessToken?: string): Promise<T> {
  if (!APP_KEY || !APP_SECRET) throw new Error('AliExpress API credentials not configured');

  const params: Record<string, string> = {
    app_key: APP_KEY,
    method,
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    ...(accessToken ? { access_token: accessToken } : {}),
    ...extraParams,
  };
  params.sign = generateSignature(params);

  const res = await fetch(`${API_BASE}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': 'hearstai-dropship/1.0' },
  });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Search products via aliexpress.ds.text.search (DS API, requires OAuth access_token).
 * Permission group: AliExpress-dropship.
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  countryCode?: string;
  currency?: string;
  locale?: string;
}): Promise<{ success: boolean; data?: AliExpressSearchResult; error?: string; needsAuth?: boolean }> {
  if (!APP_KEY || !APP_SECRET) {
    return { success: false, error: 'AliExpress credentials not configured' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      needsAuth: true,
      error: 'AliExpress OAuth token manquant — va sur /api/aliexpress/oauth/start pour autoriser.',
    };
  }

  try {
    type DsTextSearchProduct = {
      itemId: string | number;
      title: string;
      itemMainPic: string;
      itemUrl: string;
      score?: string;
      evaluateRate?: string;
      orders?: string;
      discount?: string;
      originalPrice?: string;
      originalPriceCurrency?: string;
      salePrice?: string;
      salePriceCurrency?: string;
      targetSalePrice?: string;
      targetOriginalPrice?: string;
      targetOriginalPriceCurrency?: string;
      cateId?: string;
    };
    type DsTextSearchResponse = {
      aliexpress_ds_text_search_response?: {
        code?: string;
        data?: {
          pageIndex?: number;
          pageSize?: number;
          totalCount?: number;
          products?: { selection_search_product?: DsTextSearchProduct[] };
        };
        error_msg?: string;
      };
      error_response?: { code: string; msg: string; sub_msg?: string };
    };

    const data = await callApi<DsTextSearchResponse>(
      'aliexpress.ds.text.search',
      {
        keyWord: params.keywords,
        pageIndex: String(params.page || 1),
        pageSize: String(Math.min(params.pageSize || 20, 50)),
        countryCode: params.countryCode || 'US',
        currency: params.currency || 'USD',
        local: params.locale || 'en_US',
      },
      accessToken,
    );

    if (data.error_response) {
      const code = data.error_response.code;
      if (code === 'invalid-sessionkey' || code === '27') {
        await getDb().query(`DELETE FROM platform_settings WHERE key = 'aliexpress_access_token'`).catch(() => {});
        return { success: false, needsAuth: true, error: 'AliExpress token expiré — re-autoriser via /api/aliexpress/oauth/start' };
      }
      return { success: false, error: `AliExpress: ${code} — ${data.error_response.sub_msg || data.error_response.msg}` };
    }

    const resp = data.aliexpress_ds_text_search_response;
    if (resp?.code && resp.code !== '00' && resp.code !== '0') {
      return { success: false, error: `AliExpress DS: ${resp.code} — ${resp.error_msg || 'unknown'}` };
    }

    const rawProducts = resp?.data?.products?.selection_search_product || [];

    const products: AliExpressProduct[] = rawProducts.map(p => {
      const url = p.itemUrl
        ? (p.itemUrl.startsWith('//') ? `https:${p.itemUrl}` : p.itemUrl)
        : `https://www.aliexpress.com/item/${p.itemId}.html`;
      return {
        product_id: String(p.itemId),
        product_title: p.title,
        product_main_image_url: p.itemMainPic,
        original_price: p.targetOriginalPrice || p.originalPrice || '0',
        sale_price: p.targetSalePrice || p.salePrice || '0',
        discount: p.discount || '',
        shop_id: '',
        shop_url: '',
        product_url: url,
        category_id: p.cateId || '',
        category_name: '',
        evaluate_rate: p.evaluateRate || p.score || '',
        thirty_days_sold_count: p.orders || '0',
      };
    });

    return {
      success: true,
      data: {
        current_page_no: resp?.data?.pageIndex || 1,
        current_record_count: products.length,
        total_record_count: resp?.data?.totalCount || products.length,
        products,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface AliExpressLogisticsAddress {
  address: string;
  city: string;
  contact_person: string;
  country: string;            // ISO-2 (e.g. "FR")
  full_name: string;
  mobile_no: string;
  phone_country: string;      // dial code without "+", e.g. "33"
  province: string;
  zip: string;
  address2?: string;
}

interface AliExpressOrderItem {
  product_count: number;
  product_id: string;         // AE itemId
  sku_attr?: string;          // optional SKU selector (e.g. "14:175;5:100")
  logistics_service_name?: string;
}

export interface AliExpressPlaceOrderInput {
  logistics_address: AliExpressLogisticsAddress;
  product_items: AliExpressOrderItem[];
  out_order_id: string;       // our id, used for idempotency
}

interface AliExpressPlaceOrderResult {
  success: boolean;
  ae_order_id?: string;
  raw: unknown;
  error?: string;
}

/**
 * Deep-link to the AE order detail page, where the buyer pays a dropshipping
 * order placed via `aliexpress.ds.order.create`. AE keeps the order in
 * "Awaiting payment" for 20 days; this URL is what the merchant clicks.
 */
export function aliExpressOrderUrl(aeOrderId: string): string {
  return `https://trade.aliexpress.com/order_detail.htm?orderId=${encodeURIComponent(aeOrderId)}`;
}

/**
 * Place a dropshipping order via aliexpress.ds.order.create.
 * Returns the raw AE response either way — caller should persist it.
 */
export async function placeOrder(input: AliExpressPlaceOrderInput): Promise<AliExpressPlaceOrderResult> {
  if (!APP_KEY || !APP_SECRET) {
    return { success: false, raw: null, error: 'AliExpress credentials not configured' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, raw: null, error: 'AliExpress OAuth token missing — re-authorize via /api/aliexpress/oauth/start' };
  }

  try {
    type DsOrderCreateResponse = {
      aliexpress_ds_order_create_response?: {
        result?: {
          is_success?: boolean;
          error_code?: string;
          error_msg?: string;
          order_list?: { number?: (string | number)[] };
        };
      };
      error_response?: { code: string; msg: string; sub_msg?: string };
    };

    const data = await callApi<DsOrderCreateResponse>(
      'aliexpress.ds.order.create',
      { param_place_order_request4_open_api_d_t_o: JSON.stringify(input) },
      accessToken,
    );

    if (data.error_response) {
      return {
        success: false,
        raw: data,
        error: `${data.error_response.code} — ${data.error_response.sub_msg || data.error_response.msg}`,
      };
    }

    const result = data.aliexpress_ds_order_create_response?.result;
    if (!result?.is_success) {
      return {
        success: false,
        raw: data,
        error: result ? `${result.error_code} — ${result.error_msg}` : 'AE returned no result',
      };
    }

    const aeOrderId = String(result.order_list?.number?.[0] ?? '');
    return { success: true, ae_order_id: aeOrderId, raw: data };
  } catch (e) {
    return { success: false, raw: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
