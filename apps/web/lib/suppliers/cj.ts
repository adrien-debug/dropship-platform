/**
 * CJ Dropshipping API client
 * Docs: https://developers.cjdropshipping.com/api2.0/v1/authentication
 */

const CJ_EMAIL = (process.env.CJ_DROPSHIPPING_EMAIL || '').trim();
const CJ_API_KEY = (process.env.CJ_DROPSHIPPING_API_KEY || '').trim();
const API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

export interface CJProduct {
  pid: string;
  productNameEn: string;
  productImage: string;
  productWeight: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  sourceFrom: number;
  sellUrl: string;
  variants?: {
    vid: string;
    variantNameEn: string;
    variantImage: string;
    variantSellPrice: number;
  }[];
}

export interface CJSearchResult {
  total: number;
  pageNum: number;
  pageSize: number;
  list: CJProduct[];
}

/**
 * Authentification CJ (access token)
 */
async function authenticate(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  if (!CJ_EMAIL || !CJ_API_KEY) {
    throw new Error('CJ Dropshipping credentials not configured (CJ_DROPSHIPPING_EMAIL, CJ_DROPSHIPPING_API_KEY)');
  }

  const response = await fetch(`${API_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: CJ_EMAIL,
      password: CJ_API_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`CJ auth failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.result || data.code !== 200) {
    throw new Error(`CJ auth error: ${data.message || 'Unknown'}`);
  }

  accessToken = data.data.accessToken;
  tokenExpiresAt = Date.now() + 3600 * 1000; // 1h
  
  if (!accessToken) {
    throw new Error('CJ API returned empty access token');
  }
  
  return accessToken;
}

/**
 * Recherche produits CJ Dropshipping
 */
export async function searchProducts(params: {
  keywords: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
}): Promise<{ success: boolean; data?: CJSearchResult; error?: string }> {
  try {
    const token = await authenticate();

    const body = {
      keyWords: params.keywords,
      pageNum: params.page || 1,
      pageSize: params.pageSize || 20,
      ...(params.categoryId && { categoryId: params.categoryId }),
    };

    const response = await fetch(`${API_BASE}/product/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`CJ API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200 || !data.result) {
      throw new Error(data.message || 'CJ API error');
    }

    return {
      success: true,
      data: {
        total: data.data.total || 0,
        pageNum: data.data.pageNum || 1,
        pageSize: data.data.pageSize || 20,
        list: data.data.list || [],
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
 * Récupère les détails d'un produit CJ
 */
export async function getProduct(pid: string): Promise<{ success: boolean; data?: CJProduct; error?: string }> {
  try {
    const token = await authenticate();

    const response = await fetch(`${API_BASE}/product/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
      },
      body: JSON.stringify({ pid }),
    });

    if (!response.ok) {
      throw new Error(`CJ API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200 || !data.result) {
      throw new Error(data.message || 'CJ API error');
    }

    return { success: true, data: data.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
