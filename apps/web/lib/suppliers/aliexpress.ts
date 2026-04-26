/**
 * AliExpress Open Platform API client
 * Docs: https://developers.aliexpress.com/en/doc.htm
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

/**
 * Recherche produits AliExpress via Affiliate Product Search API
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'default' | 'salesDesc' | 'priceAsc' | 'priceDesc';
}): Promise<{ success: boolean; data?: AliExpressSearchResult; error?: string }> {
  if (!APP_KEY || !APP_SECRET) {
    return {
      success: false,
      error: 'AliExpress API credentials not configured (ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET)',
    };
  }

  try {
    // AliExpress Open Platform nécessite signature + timestamp
    const timestamp = Date.now().toString();
    const method = 'aliexpress.affiliate.product.query';
    
    const apiParams: Record<string, string> = {
      app_key: APP_KEY,
      method,
      timestamp,
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      keywords: params.keywords,
      page_no: String(params.page || 1),
      page_size: String(params.pageSize || 20),
    };

    if (params.minPrice) apiParams.min_price = String(params.minPrice);
    if (params.maxPrice) apiParams.max_price = String(params.maxPrice);
    if (params.sort) apiParams.sort = params.sort;

    // Signature MD5 (AliExpress specific)
    const sign = generateSignature(apiParams, APP_SECRET);
    apiParams.sign = sign;

    const url = `${API_BASE}?${new URLSearchParams(apiParams)}`;
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`AliExpress API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Structure de réponse AliExpress peut varier — adapter selon la doc réelle
    if (data.error_response) {
      throw new Error(data.error_response.msg || 'AliExpress API error');
    }

    const result = data.aliexpress_affiliate_product_query_response?.resp_result;
    if (!result) {
      throw new Error('Unexpected AliExpress API response structure');
    }

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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Génère la signature MD5 pour AliExpress API
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}${params[k]}`)
    .join('');
  
  const str = `${secret}${sorted}${secret}`;
  return createHash('md5').update(str).digest('hex').toUpperCase();
}
