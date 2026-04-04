import type { SupplierClient, SupplierProduct } from './interface';

interface CJConfig {
  apiKey: string;
}

export class CJDropshippingClient implements SupplierClient {
  private baseUrl = 'https://developers.cjdropshipping.com/api2.0/v1';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry = 0;
  private apiKey: string;

  constructor(config: CJConfig) {
    this.apiKey = config.apiKey;
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const res = await fetch(`${this.baseUrl}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });
    if (!res.ok) throw new Error(`CJ Auth error: ${res.status}`);
    const json = (await res.json()) as {
      result?: boolean;
      code?: number;
      message?: string;
      data?: { accessToken: string; refreshToken?: string; accessTokenExpiryDate?: string };
    };
    if (!json.result || json.code !== 200) {
      throw new Error(`CJ Auth failed: ${json.message ?? JSON.stringify(json)}`);
    }
    this.accessToken = json.data!.accessToken;
    this.refreshToken = json.data!.refreshToken ?? null;
    const expiry = json.data!.accessTokenExpiryDate;
    this.tokenExpiry = expiry ? new Date(expiry).getTime() - 60_000 : Date.now() + 14 * 86400_000;
    return this.accessToken!;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const token = await this.authenticate();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`CJ API error: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { code: number; message?: string; data: unknown };
    if (json.code !== 200) throw new Error(`CJ API error: ${json.message}`);
    return json.data;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
    const limit = options?.limit ?? 20;
    const all: SupplierProduct[] = [];

    for (const keyword of keywords) {
      if (all.length >= limit) break;
      const data = await this.request('GET', `/product/list?productNameEn=${encodeURIComponent(keyword)}&pageNum=1&pageSize=${Math.min(limit - all.length, 20)}`) as { list?: unknown[] };
      if (data?.list) {
        all.push(...data.list.map(p => this.mapProduct(p as Record<string, unknown>)));
      }
      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return all;
  }

  async getProduct(externalId: string): Promise<SupplierProduct | null> {
    try {
      const data = await this.request('GET', `/product/query?pid=${externalId}`);
      return this.mapProduct(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  private mapProduct(raw: Record<string, unknown>): SupplierProduct {
    const variants = Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>[]).map(v => ({
          sku: String(v.variantSku ?? ''),
          name: String(v.variantNameEn ?? ''),
          costCents: Math.round(Number(v.variantSellPrice ?? raw.sellPrice ?? 0) * 100),
          stock: Number(v.variantVolume ?? 999),
          attributes: {} as Record<string, string>,
        }))
      : [{
          sku: String(raw.productSku ?? ''),
          name: String(raw.productNameEn ?? ''),
          costCents: Math.round(Number(raw.sellPrice ?? 0) * 100),
          stock: 999,
          attributes: {},
        }];

    return {
      externalId: String(raw.pid ?? raw.productId ?? ''),
      name: String(raw.productNameEn ?? ''),
      description: String(raw.description ?? raw.productNameEn ?? ''),
      costCents: Math.round(Number(raw.sellPrice ?? 0) * 100),
      category: String(raw.categoryName ?? 'Uncategorized'),
      imageUrls: [String(raw.productImage ?? '')].filter(Boolean),
      variants,
      shippingDays: { min: 15, max: 30 },
    };
  }
}

export function getCJClient(): CJDropshippingClient | null {
  const apiKey = process.env.CJ_DROPSHIPPING_API_KEY;
  if (!apiKey) return null;
  return new CJDropshippingClient({ apiKey });
}
