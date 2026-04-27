/**
 * AliExpress Open Platform — DS API client
 * App: Hearstai | AppKey: 531346 | Category: Drop Shipping | Status: Online
 *
 * Auth: OAuth access_token obtained via /api/aliexpress/oauth/start
 * Primary search API: aliexpress.solution.product.list.get (requires access_token)
 * Fallback: aliexpress.ds.category.get (no token needed, for health checks)
 */

import { createHash, createHmac } from 'crypto';
import { getDb } from '@/lib/db';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();
const API_BASE = 'https://api-sg.aliexpress.com/sync';
const REST_BASE = 'https://api-sg.aliexpress.com/rest';

export interface AliExpressProduct {
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

export interface AliExpressSearchResult {
  current_page_no: number;
  current_record_count: number;
  total_record_count: number;
  products: AliExpressProduct[];
}

export interface AliExpressCategory {
  category_id: number;
  category_name: string;
  parent_category_id?: number;
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
    const data = await res.json() as { access_token?: string; expire_time?: number; refresh_token?: string };

    if (!data.access_token) return null;

    const db = getDb();
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('aliexpress_access_token', $1, now()),
              ('aliexpress_token_expires', $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [data.access_token, data.expire_time?.toString() || ''],
    );
    if (data.refresh_token) {
      await db.query(
        `INSERT INTO platform_settings (key, value, updated_at) VALUES ('aliexpress_refresh_token', $1, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [data.refresh_token],
      );
    }

    return data.access_token;
  } catch {
    return null;
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
 * Search products via aliexpress.solution.product.list.get (DS API, requires access_token).
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  sort?: 'default' | 'salesDesc' | 'priceAsc' | 'priceDesc';
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
    type DsProductListResponse = {
      aliexpress_solution_product_list_get_response?: {
        result?: {
          current_page_no?: number;
          current_record_count?: number;
          total_record_count?: number;
          products?: {
            aliexpress_product?: Array<{
              product_id: number;
              subject: string;
              image_url: string;
              ws_display: string;
              min_price?: string;
              max_price?: string;
              wishs_count?: number;
              order_count?: number;
            }>;
          };
        };
        rsp_code?: string;
        rsp_msg?: string;
      };
      error_response?: { code: string; msg: string; sub_msg?: string };
    };

    const sortMap: Record<string, string> = {
      salesDesc: 'SALE_PRICE_ASC',
      priceAsc: 'SALE_PRICE_ASC',
      priceDesc: 'SALE_PRICE_DESC',
    };

    const data = await callApi<DsProductListResponse>(
      'aliexpress.solution.product.list.get',
      {
        keywords: params.keywords,
        page_index: String(params.page || 1),
        page_size: String(Math.min(params.pageSize || 20, 50)),
        local_country: 'FR',
        local_currency: 'EUR',
        ...(params.sort && params.sort !== 'default' ? { sort: sortMap[params.sort] || '' } : {}),
      },
      accessToken,
    );

    if (data.error_response) {
      const code = data.error_response.code;
      if (code === 'invalid-sessionkey' || code === '27') {
        // Token expired, clear it so next call re-auths
        await getDb().query(`DELETE FROM platform_settings WHERE key = 'aliexpress_access_token'`).catch(() => {});
        return { success: false, needsAuth: true, error: 'AliExpress token expiré — re-autoriser via /api/aliexpress/oauth/start' };
      }
      return { success: false, error: `AliExpress: ${data.error_response.code} — ${data.error_response.sub_msg || data.error_response.msg}` };
    }

    const resp = data.aliexpress_solution_product_list_get_response;
    if (resp?.rsp_code && resp.rsp_code !== '200') {
      return { success: false, error: `AliExpress DS: ${resp.rsp_code} — ${resp.rsp_msg}` };
    }

    const result = resp?.result;
    const rawProducts = result?.products?.aliexpress_product || [];

    const products: AliExpressProduct[] = rawProducts.map(p => ({
      product_id: String(p.product_id),
      product_title: p.subject,
      product_main_image_url: p.image_url,
      original_price: p.max_price || p.min_price || '0',
      sale_price: p.min_price || '0',
      discount: '',
      shop_id: '',
      shop_url: '',
      product_url: `https://www.aliexpress.com/item/${p.product_id}.html`,
      category_id: '',
      category_name: '',
      evaluate_rate: '',
      thirty_days_sold_count: String(p.order_count || 0),
    }));

    return {
      success: true,
      data: {
        current_page_no: result?.current_page_no || 1,
        current_record_count: products.length,
        total_record_count: result?.total_record_count || products.length,
        products,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Health check — fetch DS categories (no token needed).
 */
export async function getCategories(): Promise<{ success: boolean; data?: AliExpressCategory[]; error?: string }> {
  if (!APP_KEY || !APP_SECRET) return { success: false, error: 'AliExpress credentials not configured' };
  try {
    const data = await callApi<{ aliexpress_ds_category_get_response?: { resp_result?: { result?: { categories?: { category?: AliExpressCategory[] } } } } }>(
      'aliexpress.ds.category.get',
      { language: 'en' },
    );
    const categories = data.aliexpress_ds_category_get_response?.resp_result?.result?.categories?.category ?? [];
    return { success: true, data: categories };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Returns true if an access token is stored and not obviously expired.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}
