const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_API_KEY = process.env['MEDUSA_API_KEY'] ?? '';

interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string;
  variants?: { id: string; title: string; prices: { amount: number; currency_code: string }[] }[];
}

export class MedusaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl ?? MEDUSA_URL;
    this.apiKey = apiKey ?? MEDUSA_API_KEY;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'x-medusa-access-token': this.apiKey } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    };

    const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(10_000) });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Medusa ${res.status}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  }

  async searchProducts(query: string, page = 1, limit = 20): Promise<MedusaProduct[]> {
    const offset = (page - 1) * limit;
    const data = await this.request<{ products: MedusaProduct[] }>(
      `/admin/products?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
    return data.products ?? [];
  }

  async getProduct(id: string): Promise<MedusaProduct> {
    const data = await this.request<{ product: MedusaProduct }>(`/admin/products/${id}`);
    return data.product;
  }

  async createProduct(payload: {
    title: string;
    handle: string;
    description?: string;
    variants: { title: string; prices: { amount: number; currency_code: string }[] }[];
  }): Promise<MedusaProduct> {
    const data = await this.request<{ product: MedusaProduct }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.product;
  }
}
