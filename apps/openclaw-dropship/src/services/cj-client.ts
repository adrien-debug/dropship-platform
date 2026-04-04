const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api/2.0';
const CJ_API_KEY = process.env['CJ_API_KEY'] ?? '';

interface CJProduct {
  pid: string;
  productNameEn: string;
  productImage: string;
  sellPrice: number;
  categoryName?: string;
}

interface CJAccessTokenResponse {
  code: number;
  data: { accessToken: string; accessTokenExpiryDate: string };
}

interface CJProductListResponse {
  code: number;
  data: { list: CJProduct[]; total: number };
  message?: string;
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
      body: JSON.stringify({ email: '', password: '', refreshToken: this.apiKey }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`CJ auth failed: ${res.status}`);
    }

    const data = (await res.json()) as CJAccessTokenResponse;
    if (data.code !== 200 || !data.data?.accessToken) {
      throw new Error(`CJ auth error: code=${data.code}`);
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
    const data = await this.request<CJProductListResponse>('/product/list', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (data.code !== 200) {
      throw new Error(`CJ product search error: ${data.message ?? `code=${data.code}`}`);
    }

    return data.data?.list ?? [];
  }

  async getProductDetail(pid: string): Promise<CJProduct> {
    const data = await this.request<{ code: number; data: CJProduct }>(
      `/product/query?pid=${encodeURIComponent(pid)}`
    );
    return data.data;
  }
}
