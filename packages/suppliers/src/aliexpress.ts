import { createHmac } from 'crypto';
import type { SupplierClient, SupplierProduct } from './interface';

interface AliExpressConfig {
  appKey: string;
  appSecret: string;
}

const API_URL = 'https://api-sg.aliexpress.com/sync';

function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const baseString = sorted.map(k => k + params[k]).join('');
  return createHmac('sha256', secret).update(baseString).digest('hex').toUpperCase();
}

export class AliExpressClient implements SupplierClient {
  private appKey: string;
  private appSecret: string;

  constructor(config: AliExpressConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
  }

  private async call(method: string, params: Record<string, string> = {}): Promise<unknown> {
    const baseParams: Record<string, string> = {
      method,
      app_key: this.appKey,
      sign_method: 'sha256',
      timestamp: String(Date.now()),
      v: '2.0',
      format: 'json',
      simplify: 'true',
      ...params,
    };

    baseParams.sign = sign(baseParams, this.appSecret);

    const qs = new URLSearchParams(baseParams).toString();
    const res = await fetch(`${API_URL}?${qs}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AliExpress API ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json() as Record<string, unknown>;
    
    // Check for error_response
    if (json['error_response']) {
      const err = json['error_response'] as Record<string, unknown>;
      throw new Error(`AliExpress API error: ${err['code']} - ${err['msg']}`);
    }

    return json;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.call('aliexpress.affiliate.product.query', {
        keywords: 'test',
        target_currency: 'EUR',
        target_language: 'EN',
        page_no: '1',
        page_size: '1',
      });
      return true;
    } catch (err) {
      console.error('[aliexpress] Connection test failed:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
    const limit = options?.limit ?? 20;
    const all: SupplierProduct[] = [];

    for (const keyword of keywords) {
      if (all.length >= limit) break;
      const remaining = limit - all.length;

      try {
        const data = await this.call('aliexpress.affiliate.product.query', {
          keywords: keyword,
          target_currency: 'EUR',
          target_language: 'EN',
          page_no: '1',
          page_size: String(Math.min(remaining, 50)),
          sort: 'SALE_PRICE_ASC',
        }) as Record<string, unknown>;

        const resp = (data as Record<string, unknown>)['aliexpress_affiliate_product_query_response'] as Record<string, unknown> | undefined;
        const result = resp?.['resp_result'] as Record<string, unknown> | undefined;
        const resultData = result?.['result'] as Record<string, unknown> | undefined;
        const products = resultData?.['products'] as Record<string, unknown> | undefined;
        const list = (products?.['product'] ?? []) as Array<Record<string, unknown>>;

        for (const p of list) {
          all.push(this.mapProduct(p));
        }

        console.log(`[aliexpress] Search "${keyword}": ${list.length} results`);
      } catch (err) {
        console.error(`[aliexpress] Search "${keyword}" failed:`, err instanceof Error ? err.message : err);
      }

      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return all.slice(0, limit);
  }

  async getProduct(externalId: string): Promise<SupplierProduct | null> {
    try {
      const data = await this.call('aliexpress.affiliate.product.query', {
        product_ids: externalId,
        target_currency: 'EUR',
        target_language: 'EN',
      }) as Record<string, unknown>;

      const resp = (data as Record<string, unknown>)['aliexpress_affiliate_product_query_response'] as Record<string, unknown> | undefined;
      const result = resp?.['resp_result'] as Record<string, unknown> | undefined;
      const resultData = result?.['result'] as Record<string, unknown> | undefined;
      const products = resultData?.['products'] as Record<string, unknown> | undefined;
      const list = (products?.['product'] ?? []) as Array<Record<string, unknown>>;

      if (list.length === 0 || !list[0]) return null;
      return this.mapProduct(list[0]);
    } catch {
      return null;
    }
  }

  private mapProduct(raw: Record<string, unknown>): SupplierProduct {
    const salePriceStr = String(raw['sale_price'] ?? raw['target_sale_price'] ?? '0');
    const originalPriceStr = String(raw['original_price'] ?? raw['target_original_price'] ?? salePriceStr);
    const costCents = Math.round(parseFloat(salePriceStr) * 100);
    const imageUrl = String(raw['product_main_image_url'] ?? '');

    const smallImages = raw['product_small_image_urls'] as Record<string, unknown> | undefined;
    const smallList = (smallImages?.['string'] ?? []) as string[];
    const allImages = [imageUrl, ...smallList].filter(Boolean);

    return {
      externalId: String(raw['product_id'] ?? ''),
      name: String(raw['product_title'] ?? ''),
      description: String(raw['product_title'] ?? ''),
      costCents,
      category: String(raw['second_level_category_name'] ?? raw['first_level_category_name'] ?? 'General'),
      imageUrls: allImages,
      variants: [{
        sku: String(raw['product_id'] ?? ''),
        name: String(raw['product_title'] ?? ''),
        costCents,
        stock: 999,
        attributes: {},
      }],
      shippingDays: { min: 10, max: 25 },
    };
  }
}

export function getAliExpressClient(): AliExpressClient | null {
  const appKey = process.env['ALIEXPRESS_APP_KEY'];
  const appSecret = process.env['ALIEXPRESS_APP_SECRET'];
  if (!appKey || !appSecret) return null;
  return new AliExpressClient({ appKey, appSecret });
}
