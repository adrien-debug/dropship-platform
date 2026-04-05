const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_API_KEY = process.env['CJ_API_KEY'] ?? '';

export interface CJProduct {
  pid: string;
  productNameEn: string;
  productImage: string;
  sellPrice: number;
  categoryName?: string;
  categoryId?: string;
  productSku?: string;
  listedNum?: number;
}

interface CJAccessTokenResponse {
  code: number;
  data: { accessToken: string; accessTokenExpiryDate: string };
}

interface CJListV2Response {
  code: number;
  result: boolean;
  message?: string;
  data: {
    pageSize: number;
    pageNumber: number;
    totalRecords: number;
    content: Array<{
      productList: Array<{
        id: string;
        nameEn: string;
        sku: string;
        bigImage: string;
        sellPrice: string;
        listedNum: number;
        categoryId?: string;
        threeCategoryName?: string;
        twoCategoryName?: string;
        oneCategoryName?: string;
        addMarkStatus?: number;
      }>;
    }>;
  };
}

export class CJClient {
  private apiKey: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? CJ_API_KEY;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`CJ auth failed: ${res.status}`);
    }

    const raw = await res.json();
    const data = raw as CJAccessTokenResponse;
    if (!data.data?.accessToken) {
      console.error('[cj-client] Auth response:', JSON.stringify(raw).slice(0, 500));
      throw new Error(`CJ auth error: code=${data.code}, result=${JSON.stringify(raw).slice(0, 200)}`);
    }

    this.accessToken = data.data.accessToken;
    this.tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime() - 60_000;
    return this.accessToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${CJ_BASE_URL}${path}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
        ...(options?.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`CJ ${res.status}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }

  async searchProducts(query: string, page = 1, limit = 20): Promise<CJProduct[]> {
    const params = new URLSearchParams({
      keyWord: query,
      page: String(page),
      size: String(Math.min(limit, 100)),
    });

    const raw = await this.request<CJListV2Response>(`/product/listV2?${params.toString()}`);

    if (raw.code !== 200) {
      throw new Error(`CJ search error: ${raw.message ?? `code=${raw.code}`}`);
    }

    const products: CJProduct[] = [];
    for (const group of raw.data?.content ?? []) {
      for (const p of group.productList ?? []) {
        products.push({
          pid: p.id,
          productNameEn: p.nameEn,
          productImage: p.bigImage,
          sellPrice: parseFloat(p.sellPrice) || 0,
          categoryName: p.threeCategoryName ?? p.twoCategoryName ?? p.oneCategoryName,
          categoryId: p.categoryId,
          productSku: p.sku,
          listedNum: p.listedNum,
        });
      }
    }

    console.log(`[cj-client] Search "${query}": ${products.length} results (total: ${raw.data?.totalRecords ?? 0})`);
    return products;
  }

  async getProductDetail(pid: string): Promise<CJProduct> {
    const data = await this.request<{ code: number; data: CJProduct }>(
      `/product/query?pid=${encodeURIComponent(pid)}`
    );
    return data.data;
  }
}
