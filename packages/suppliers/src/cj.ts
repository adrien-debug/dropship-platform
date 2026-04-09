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
      const pageSize = Math.min(limit - all.length, 20);

      // product/list (v1) actually filters by keyword; listV2 ignores it
      const data = await this.request(
        'GET',
        `/product/list?productNameEn=${encodeURIComponent(keyword)}&pageNum=1&pageSize=${pageSize}`,
      ) as {
        list?: unknown[];
        total?: number;
      };

      if (data?.list) {
        all.push(...data.list.map(p => this.mapProduct(p as Record<string, unknown>)));
      }

      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return all;
  }

  async createOrder(params: {
    orderNumber: string;
    shippingAddress: {
      name: string;
      address: string;
      city: string;
      country: string;
      zip: string;
      phone: string;
    };
    products: { vid: string; quantity: number }[];
  }): Promise<{ orderId: string; orderNumber: string; status: string }> {
    const data = await this.request('POST', '/shopping/order/createOrder', {
      orderNumber: params.orderNumber,
      shippingCustomerName: params.shippingAddress.name,
      shippingAddress: params.shippingAddress.address,
      shippingCity: params.shippingAddress.city,
      shippingCountryCode: params.shippingAddress.country,
      shippingZip: params.shippingAddress.zip,
      shippingPhone: params.shippingAddress.phone,
      products: params.products,
    }) as { orderId: string; orderNum: string };
    return {
      orderId: data.orderId,
      orderNumber: data.orderNum,
      status: 'placed',
    };
  }

  async getProduct(externalId: string): Promise<SupplierProduct | null> {
    try {
      const data = await this.request('GET', `/product/query?pid=${externalId}`);
      return this.mapProduct(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  private parseSellPrice(val: unknown): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // CJ v2 returns ranges like "0.26 -- 0.52" — take the higher value
      const parts = val.split('--').map(s => parseFloat(s.trim()));
      const valid = parts.filter(n => !isNaN(n));
      return valid.length > 0 ? Math.max(...valid) : 0;
    }
    return 0;
  }

  private mapProduct(raw: Record<string, unknown>): SupplierProduct {
    const sellPrice = this.parseSellPrice(raw.sellPrice);
    const variants = Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>[]).map(v => ({
          sku: String(v.variantSku ?? v.sku ?? ''),
          name: String(v.variantNameEn ?? v.nameEn ?? ''),
          costCents: Math.round(Number(v.variantSellPrice ?? v.sellPrice ?? sellPrice) * 100),
          stock: Number(v.variantVolume ?? 999),
          attributes: {} as Record<string, string>,
        }))
      : [{
          sku: String(raw.productSku ?? raw.sku ?? ''),
          name: String(raw.productNameEn ?? raw.nameEn ?? ''),
          costCents: Math.round(sellPrice * 100),
          stock: 999,
          attributes: {},
        }];

    // v2 API uses id/nameEn/bigImage, v1 uses pid/productNameEn/productImage
    const name = String(raw.productNameEn ?? raw.nameEn ?? '');
    const image = String(raw.productImage ?? raw.bigImage ?? '');
    const category = String(
      raw.categoryName ?? raw.threeCategoryName ?? raw.twoCategoryName ?? raw.oneCategoryName ?? 'Uncategorized'
    );

    return {
      externalId: String(raw.pid ?? raw.id ?? raw.productId ?? ''),
      name,
      description: String(raw.description ?? name),
      costCents: Math.round(sellPrice * 100),
      category,
      imageUrls: image ? [image] : [],
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
