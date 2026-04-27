/**
 * AliExpress Open Platform — DS (Dropshipping) API client
 * App: Hearstai | AppKey: 531346 | Category: Drop Shipping | Status: Online
 *
 * API status:
 * - aliexpress.ds.category.get → works (no OAuth needed)
 * - aliexpress.ds.text.search  → needs DS seller account linked (apply via App Console → Apply process)
 * - aliexpress.affiliate.product.query → needs Affiliate permission (Apply process → API Permission Group)
 * - aliexpress.ds.product.get  → needs OAuth access_token (seller auth flow)
 */

import { createHash } from 'crypto';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();
const APP_SECRET = (process.env.ALIEXPRESS_APP_SECRET || '').trim();
const API_BASE = 'https://api-sg.aliexpress.com/sync';

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

function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  return createHash('md5').update(`${secret}${sorted}${secret}`).digest('hex').toUpperCase();
}

async function callApi<T>(method: string, extraParams: Record<string, string>): Promise<T> {
  if (!APP_KEY || !APP_SECRET) throw new Error('AliExpress API credentials not configured');

  const params: Record<string, string> = {
    app_key: APP_KEY,
    method,
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    ...extraParams,
  };
  params.sign = generateSignature(params, APP_SECRET);

  const res = await fetch(`${API_BASE}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': 'hearstai-dropship/1.0' },
  });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Fetch DS categories (works without OAuth or Affiliate permission).
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
 * Search products via affiliate API.
 * Requires "Affiliate Product Query" permission — apply at:
 * open.aliexpress.com → App Console → Apply process → API Permission Group
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  sort?: 'default' | 'salesDesc' | 'priceAsc' | 'priceDesc';
  trackingId?: string;
}): Promise<{ success: boolean; data?: AliExpressSearchResult; error?: string; needsPermission?: boolean }> {
  if (!APP_KEY || !APP_SECRET) {
    return { success: false, error: 'AliExpress credentials not configured (ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET)' };
  }

  try {
    type AffiliateResponse = {
      error_response?: { code: string; msg: string };
      aliexpress_affiliate_product_query_response?: {
        resp_result?: {
          result?: {
            current_page_no?: number;
            current_record_count?: number;
            total_record_count?: number;
            products?: { product?: AliExpressProduct[] };
          };
        };
      };
    };

    const data = await callApi<AffiliateResponse>('aliexpress.affiliate.product.query', {
      keywords: params.keywords,
      page_no: String(params.page || 1),
      page_size: String(params.pageSize || 20),
      tracking_id: params.trackingId || 'hearstai',
      fields: 'product_id,product_title,sale_price,original_price,product_main_image_url,product_url,category_name,evaluate_rate,thirty_days_sold_count',
      target_currency: 'EUR',
      target_language: 'FR',
      ship_to_country: 'FR',
      ...(params.sort && params.sort !== 'default' ? { sort: params.sort } : {}),
    });

    if (data.error_response?.code === 'InsufficientPermission') {
      return {
        success: false,
        needsPermission: true,
        error: 'AliExpress: Affiliate Product Query permission required. Go to open.aliexpress.com → App Console → Apply process → API Permission Group → apply for "Affiliate Product Query".',
      };
    }

    if (data.error_response) {
      return { success: false, error: `AliExpress: ${data.error_response.code} — ${data.error_response.msg}` };
    }

    const result = data.aliexpress_affiliate_product_query_response?.resp_result?.result;
    if (!result) return { success: false, error: 'Unexpected AliExpress response structure' };

    return {
      success: true,
      data: {
        current_page_no: result.current_page_no || 1,
        current_record_count: result.current_record_count || 0,
        total_record_count: result.total_record_count || 0,
        products: result.products?.product || [],
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
