/**
 * Medusa API Integration (Medusa v2)
 * Admin JWT: POST /auth/user/emailpass
 * Secret API key: header x-medusa-access-token (voir Medusa Admin > Settings > Secret API Keys)
 */

const DEV_FALLBACK_MEDUSA_URL = 'https://medusa-production-656a.up.railway.app';

/** URL Medusa : toujours `MEDUSA_URL` en prod / Vercel / Railway ; fallback uniquement en `next dev`. */
export function getMedusaBaseUrl(): string {
  const fromEnv = (process.env.MEDUSA_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'development') {
    return DEV_FALLBACK_MEDUSA_URL.replace(/\/$/, '');
  }
  return '';
}

const MEDUSA_ADMIN_EMAIL = (process.env.MEDUSA_ADMIN_EMAIL || '').trim();
const MEDUSA_ADMIN_PASSWORD = (process.env.MEDUSA_ADMIN_PASSWORD || '').trim();
const MEDUSA_ADMIN_API_TOKEN = (process.env.MEDUSA_ADMIN_API_TOKEN || '').trim();

async function readMedusaErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const j = JSON.parse(text) as { message?: unknown; type?: unknown };
    if (typeof j.message === 'string') return j.message;
    if (typeof j.type === 'string') return j.type;
  } catch {
    /* ignore */
  }
  return text.slice(0, 280) || `HTTP ${response.status}`;
}

export type MedusaAuthMode = 'api_token' | 'jwt' | 'missing';

export function getMedusaAuthMode(): MedusaAuthMode {
  if (MEDUSA_ADMIN_API_TOKEN) return 'api_token';
  if (MEDUSA_ADMIN_EMAIL && MEDUSA_ADMIN_PASSWORD) return 'jwt';
  return 'missing';
}

export interface MedusaProduct {
  id: string;
  title: string;
  description?: string;
  subtitle?: string;
  handle: string;
  is_giftcard: boolean;
  status: 'draft' | 'proposed' | 'published' | 'rejected';
  thumbnail?: string;
  images?: { url: string }[];
  options?: { title: string; values: string[] }[];
  variants?: MedusaProductVariant[];
  categories?: { id: string; name: string }[];
  tags?: { id: string; value: string }[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  origin_country?: string;
  material?: string;
  collection_id?: string;
  type_id?: string;
  external_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MedusaProductVariant {
  id: string;
  title: string;
  sku?: string;
  barcode?: string;
  ean?: string;
  upc?: string;
  inventory_quantity: number;
  allow_backorder: boolean;
  manage_inventory: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  material?: string;
  prices?: {
    currency_code: string;
    amount: number;
  }[];
  options?: { value: string }[];
}

class MedusaAPI {
  private baseUrl: string;
  private jwt?: string;

  constructor() {
    this.baseUrl = getMedusaBaseUrl();
  }

  /**
   * Check API configuration (URL + présence d’au moins une méthode d’auth admin)
   */
  checkConfig(): { ok: boolean; message: string } {
    if (!this.baseUrl) {
      return {
        ok: false,
        message:
          'MEDUSA_URL manquant : définir sur Vercel / Railway (Project Settings → Environment Variables). En local, utiliser .env.local.',
      };
    }
    const mode = getMedusaAuthMode();
    if (mode === 'missing') {
      return {
        ok: false,
        message:
          'Identifiants Medusa manquants : définir MEDUSA_ADMIN_API_TOKEN (clé secrète Admin, recommandé) ou MEDUSA_ADMIN_EMAIL + MEDUSA_ADMIN_PASSWORD dans .env.local',
      };
    }
    return {
      ok: true,
      message:
        mode === 'api_token'
          ? `Medusa configuré (${this.baseUrl}, auth par clé API)`
          : `Medusa configuré (${this.baseUrl}, auth email/mot de passe)`,
    };
  }

  /** En-têtes pour les routes /admin (JWT ou clé secrète Medusa v2) */
  private async getAdminAuthHeaders(): Promise<Record<string, string>> {
    if (MEDUSA_ADMIN_API_TOKEN) {
      return { 'x-medusa-access-token': MEDUSA_ADMIN_API_TOKEN };
    }
    const jwt = await this.authenticateJwt();
    return { Authorization: `Bearer ${jwt}` };
  }

  private async adminJsonHeaders(): Promise<Record<string, string>> {
    return {
      ...(await this.getAdminAuthHeaders()),
      'Content-Type': 'application/json',
    };
  }

  /**
   * JWT admin (Medusa v2) — ignoré si MEDUSA_ADMIN_API_TOKEN est défini
   */
  async authenticateJwt(): Promise<string> {
    if (MEDUSA_ADMIN_API_TOKEN) {
      throw new Error('authenticateJwt: use MEDUSA_ADMIN_API_TOKEN path instead');
    }
    if (this.jwt) return this.jwt;

    if (!MEDUSA_ADMIN_EMAIL || !MEDUSA_ADMIN_PASSWORD) {
      throw new Error(
        'MEDUSA_ADMIN_EMAIL et MEDUSA_ADMIN_PASSWORD requis (ou utiliser MEDUSA_ADMIN_API_TOKEN)',
      );
    }

    const response = await fetch(`${this.baseUrl}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: MEDUSA_ADMIN_EMAIL,
        password: MEDUSA_ADMIN_PASSWORD,
      }),
    });

    if (!response.ok) {
      const detail = await readMedusaErrorMessage(response);
      console.error('[Medusa] Auth JWT failed', { status: response.status, detail });
      throw new Error(`Medusa auth (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as { token?: string; access_token?: string };
    const token = data.token ?? data.access_token;
    if (typeof token === 'string' && token.length > 0) {
      this.jwt = token;
      return this.jwt;
    }

    console.error('[Medusa] Auth response without token', { keys: data ? Object.keys(data) : [] });
    throw new Error('Medusa auth: réponse sans token (attendu: token ou access_token)');
  }

  /** @deprecated utiliser authenticateJwt — conservé pour compat */
  async authenticate(): Promise<string> {
    return this.authenticateJwt();
  }

  /**
   * Vérifie /health + un GET /admin/products?limit=1
   */
  async verifyAdminConnection(): Promise<{
    healthOk: boolean;
    authMode: MedusaAuthMode;
    authOk: boolean;
    message: string;
  }> {
    const authMode = getMedusaAuthMode();
    let healthOk = false;
    try {
      await this.health();
      healthOk = true;
    } catch (e) {
      console.error('[Medusa] Health check failed', e instanceof Error ? e.message : e);
    }

    if (authMode === 'missing') {
      return {
        healthOk,
        authMode,
        authOk: false,
        message:
          'Aucune auth : ajoute MEDUSA_ADMIN_API_TOKEN ou MEDUSA_ADMIN_EMAIL + MEDUSA_ADMIN_PASSWORD dans apps/web/.env.local puis redémarre `npm run dev`.',
      };
    }

    try {
      const headers = await this.adminJsonHeaders();
      const res = await fetch(`${this.baseUrl}/admin/products?limit=1`, { headers });
      if (!res.ok) {
        const detail = await readMedusaErrorMessage(res);
        console.error('[Medusa] Admin probe failed', { status: res.status, detail });
        return {
          healthOk,
          authMode,
          authOk: false,
          message: healthOk
            ? `API admin refusée (${res.status}): ${detail}`
            : `Health KO et admin (${res.status}): ${detail}`,
        };
      }
      return {
        healthOk,
        authMode,
        authOk: true,
        message: healthOk
          ? 'Medusa joignable et authentification admin OK.'
          : 'Authentification admin OK (endpoint /health non OK ou injoignable).',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      console.error('[Medusa] verifyAdminConnection error', msg);
      return { healthOk, authMode, authOk: false, message: msg };
    }
  }

  async getProducts(params?: {
    limit?: number;
    offset?: number;
    q?: string;
    status?: string;
  }): Promise<{ products: MedusaProduct[]; count: number }> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));
    if (params?.q) queryParams.set('q', params.q);
    if (params?.status) queryParams.set('status', params.status);

    const response = await fetch(`${this.baseUrl}/admin/products?${queryParams}`, {
      headers: await this.adminJsonHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} — ${await readMedusaErrorMessage(response)}`);
    }

    const data = await response.json();
    return {
      products: data.products || [],
      count: data.count || 0,
    };
  }

  async getProduct(productId: string): Promise<MedusaProduct> {
    const response = await fetch(`${this.baseUrl}/admin/products/${productId}`, {
      headers: await this.adminJsonHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status}`);
    }

    const data = await response.json();
    return data.product;
  }

  async createProduct(product: {
    title: string;
    description?: string;
    handle?: string;
    status?: 'draft' | 'proposed' | 'published' | 'rejected';
    thumbnail?: string;
    images?: string[];
    options?: { title: string; values: string[] }[];
    variants?: {
      title: string;
      sku?: string;
      prices: { currency_code: string; amount: number }[];
      inventory_quantity?: number;
    }[];
    categories?: { id: string }[];
    tags?: { value: string }[];
    external_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MedusaProduct> {
    // Medusa v2: images must be [{ url }], not string[]; variants have no inventory_quantity
    const { images, variants, ...rest } = product;
    const payload = {
      ...rest,
      status: product.status || 'draft',
      ...(images?.length ? { images: images.map(url => ({ url })) } : {}),
      ...(variants ? {
        variants: variants.map(({ inventory_quantity: _iq, ...v }) => v),
      } : {}),
    };

    const response = await fetch(`${this.baseUrl}/admin/products`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await readMedusaErrorMessage(response);
      throw new Error(`Failed to create product: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.product;
  }

  async updateProduct(productId: string, updates: Partial<MedusaProduct>): Promise<MedusaProduct> {
    const response = await fetch(`${this.baseUrl}/admin/products/${productId}`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update product: ${response.status}`);
    }

    const data = await response.json();
    return data.product;
  }

  async deleteProduct(productId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/admin/products/${productId}`, {
      method: 'DELETE',
      headers: await this.getAdminAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete product: ${response.status}`);
    }
  }

  async publishProduct(productId: string): Promise<MedusaProduct> {
    return this.updateProduct(productId, { status: 'published' });
  }

  async createCollection(data: {
    title: string;
    handle?: string;
  }): Promise<{ id: string; title: string; handle: string }> {
    const response = await fetch(`${this.baseUrl}/admin/collections`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create collection: ${response.status}`);
    }

    const result = await response.json();
    return result.collection;
  }

  async getCollections(): Promise<{ id: string; title: string; handle: string }[]> {
    const response = await fetch(`${this.baseUrl}/admin/collections`, {
      headers: await this.adminJsonHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch collections: ${response.status}`);
    }

    const data = await response.json();
    return data.collections || [];
  }

  async createProductType(value: string): Promise<{ id: string; value: string }> {
    const response = await fetch(`${this.baseUrl}/admin/product-types`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create product type: ${response.status}`);
    }

    const data = await response.json();
    return data.product_type;
  }

  async getProductTypes(): Promise<{ id: string; value: string }[]> {
    const response = await fetch(`${this.baseUrl}/admin/product-types`, {
      headers: await this.adminJsonHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product types: ${response.status}`);
    }

    const data = await response.json();
    return data.product_types || [];
  }

  async getStore(): Promise<{ id: string; name: string; default_currency_code: string }> {
    const response = await fetch(`${this.baseUrl}/store`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch store: ${response.status}`);
    }

    const data = await response.json();
    return data.store;
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    const text = await response.text();
    return { status: text };
  }

  async createSalesChannel(name: string, description?: string): Promise<{ id: string; name: string }> {
    const response = await fetch(`${this.baseUrl}/admin/sales-channels`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify({ name, description: description || name }),
    });
    if (!response.ok) throw new Error(`createSalesChannel: ${await readMedusaErrorMessage(response)}`);
    const data = await response.json();
    return data.sales_channel;
  }

  async addProductsToSalesChannel(salesChannelId: string, productIds: string[]): Promise<void> {
    // Medusa v2: POST /admin/sales-channels/:id/products with { add: [...] }
    const response = await fetch(`${this.baseUrl}/admin/sales-channels/${salesChannelId}/products`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify({ add: productIds }),
    });
    if (!response.ok) throw new Error(`addProductsToChannel: ${await readMedusaErrorMessage(response)}`);
  }

  async createPublishableApiKey(title: string): Promise<{ id: string; token: string; title: string }> {
    // Medusa v2: POST /admin/api-keys with type: "publishable"
    const response = await fetch(`${this.baseUrl}/admin/api-keys`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify({ title, type: 'publishable' }),
    });
    if (!response.ok) throw new Error(`createPublishableKey: ${await readMedusaErrorMessage(response)}`);
    const data = await response.json();
    return data.api_key;
  }

  async addSalesChannelsToPublishableKey(keyId: string, salesChannelIds: string[]): Promise<void> {
    // Medusa v2: POST /admin/api-keys/:id/sales-channels with { add: [...] }
    const response = await fetch(`${this.baseUrl}/admin/api-keys/${keyId}/sales-channels`, {
      method: 'POST',
      headers: await this.adminJsonHeaders(),
      body: JSON.stringify({ add: salesChannelIds }),
    });
    if (!response.ok) throw new Error(`addChannelsToKey: ${await readMedusaErrorMessage(response)}`);
  }

  async createProductWithChannel(
    product: Parameters<typeof this.createProduct>[0],
    salesChannelId: string,
  ): Promise<MedusaProduct> {
    const created = await this.createProduct({ ...product, status: 'published' });
    await this.addProductsToSalesChannel(salesChannelId, [created.id]);
    return created;
  }
}

export const medusa = new MedusaAPI();

export async function publishToMedusa(supplierProduct: {
  title: string;
  description: string;
  price_cents: number;
  cost_cents: number;
  category: string;
  supplier: string;
  external_id: string;
  image_url: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; product?: MedusaProduct; error?: string }> {
  try {
    const handle = supplierProduct.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const product = await medusa.createProduct({
      title: supplierProduct.title,
      description: supplierProduct.description,
      handle: `${handle}-${Date.now()}`,
      status: 'draft',
      thumbnail: supplierProduct.image_url,
      images: supplierProduct.image_url ? [supplierProduct.image_url] : [],
      variants: [
        {
          title: 'Default',
          prices: [
            {
              currency_code: 'eur',
              amount: supplierProduct.price_cents,
            },
          ],
          inventory_quantity: 100,
        },
      ],
      tags: [
        { value: supplierProduct.category },
        { value: supplierProduct.supplier },
      ],
      external_id: supplierProduct.external_id,
      metadata: {
        ...supplierProduct.metadata,
        cost_cents: supplierProduct.cost_cents,
        supplier: supplierProduct.supplier,
        imported_from: 'supplier_api',
      },
    });

    return { success: true, product };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
