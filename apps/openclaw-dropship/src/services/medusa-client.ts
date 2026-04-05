const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_PUBLISHABLE_KEY = process.env['MEDUSA_PUBLISHABLE_KEY'] ?? '';
const MEDUSA_ADMIN_EMAIL = process.env['MEDUSA_ADMIN_EMAIL'] ?? '';
const MEDUSA_ADMIN_PASSWORD = process.env['MEDUSA_ADMIN_PASSWORD'] ?? '';

interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string;
  variants?: { id: string; title: string; prices: { amount: number; currency_code: string }[] }[];
}

export class MedusaClient {
  private baseUrl: string;
  private publishableKey: string;
  private adminToken: string | null = null;
  private adminTokenExpiry = 0;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? MEDUSA_URL;
    this.publishableKey = MEDUSA_PUBLISHABLE_KEY;
  }

  async healthCheck(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  }

  async searchProducts(query: string, page = 1, limit = 20): Promise<MedusaProduct[]> {
    const offset = (page - 1) * limit;
    const url = `${this.baseUrl}/store/products?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        'x-publishable-api-key': this.publishableKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Medusa store search ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { products: MedusaProduct[] };
    return data.products ?? [];
  }

  private async getAdminToken(): Promise<string> {
    if (this.adminToken && Date.now() < this.adminTokenExpiry) {
      return this.adminToken;
    }

    const res = await fetch(`${this.baseUrl}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: MEDUSA_ADMIN_EMAIL, password: MEDUSA_ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Medusa admin auth failed: ${res.status}`);
    const body = (await res.json()) as { token: string };
    this.adminToken = body.token;
    const token = body.token;
    this.adminTokenExpiry = Date.now() + 3_600_000;
    return token;
  }

  private async adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAdminToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Medusa admin ${res.status}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }

  async createSalesChannel(name: string): Promise<string> {
    const data = await this.adminRequest<{ sales_channel: { id: string } }>('/admin/sales-channels', {
      method: 'POST',
      body: JSON.stringify({ name, description: `Auto-created: ${name}` }),
    });
    return data.sales_channel.id;
  }

  async createProduct(payload: {
    title: string;
    handle: string;
    description?: string;
    status?: string;
    sales_channels?: { id: string }[];
    images?: { url: string }[];
    metadata?: Record<string, unknown>;
    options?: { title: string; values: string[] }[];
    variants?: { title: string; options: Record<string, string>; prices: { amount: number; currency_code: string }[] }[];
  }): Promise<MedusaProduct> {
    const priceAmount = payload.metadata?.cost_cents
      ? Math.round(Number(payload.metadata.cost_cents) * 2.5)
      : 1999;

    const body = {
      ...payload,
      status: payload.status ?? 'published',
      options: payload.options ?? [{ title: 'Default', values: ['Standard'] }],
      variants: payload.variants ?? [{
        title: 'Default',
        options: { Default: 'Standard' },
        prices: [{ amount: priceAmount, currency_code: 'eur' }],
      }],
    };
    const data = await this.adminRequest<{ product: MedusaProduct }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data.product;
  }

  async getProduct(id: string): Promise<MedusaProduct> {
    const data = await this.adminRequest<{ product: MedusaProduct }>(`/admin/products/${id}`);
    return data.product;
  }

  async createPublishableKey(title: string, salesChannelId: string): Promise<{ id: string; token: string }> {
    const data = await this.adminRequest<{ api_key: { id: string; token: string } }>('/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({ title, type: 'publishable' }),
    });

    const keyId = data.api_key.id;
    const token = data.api_key.token;

    await this.adminRequest(`/admin/api-keys/${keyId}/sales-channels`, {
      method: 'POST',
      body: JSON.stringify({ add: [salesChannelId] }),
    });

    console.log(`[medusa] Publishable key created: ${keyId} linked to ${salesChannelId}`);
    return { id: keyId, token };
  }
}
