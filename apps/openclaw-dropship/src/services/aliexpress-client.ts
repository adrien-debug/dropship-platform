import { createHmac } from 'crypto';

const API_URL = 'https://api-sg.aliexpress.com/sync';
const APP_KEY = process.env['ALIEXPRESS_APP_KEY'] ?? '';
const APP_SECRET = process.env['ALIEXPRESS_APP_SECRET'] ?? '';

interface AEProduct {
  externalId: string;
  name: string;
  costCents: number;
  category: string;
  imageUrls: string[];
}

function signParams(params: Record<string, string>, secret: string, apiPath: string): string {
  const sorted = Object.keys(params).sort();
  const baseString = apiPath + sorted.map(k => k + params[k]).join('');
  return createHmac('sha256', secret).update(baseString).digest('hex').toUpperCase();
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class AliExpressClient {
  private appKey: string;
  private appSecret: string;

  constructor(appKey: string, appSecret: string) {
    this.appKey = appKey;
    this.appSecret = appSecret;
  }

  static create(): AliExpressClient | null {
    if (!APP_KEY || !APP_SECRET) return null;
    return new AliExpressClient(APP_KEY, APP_SECRET);
  }

  private async call(method: string, params: Record<string, string> = {}): Promise<unknown> {
    const baseParams: Record<string, string> = {
      method,
      app_key: this.appKey,
      sign_method: 'hmac-sha256',
      timestamp: ts(),
      v: '2.0',
      format: 'json',
      simplify: 'true',
      ...params,
    };

    const apiPath = '/' + method.replace(/\./g, '/');
    baseParams.sign = signParams(baseParams, this.appSecret, apiPath);

    const qs = new URLSearchParams(baseParams).toString();
    const res = await fetch(`${API_URL}?${qs}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AliExpress ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json();
  }

  async searchProducts(keywords: string[], limit = 20): Promise<AEProduct[]> {
    const all: AEProduct[] = [];

    for (const keyword of keywords) {
      if (all.length >= limit) break;
      try {
        const data = await this.call('aliexpress.affiliate.product.query', {
          keywords: keyword,
          target_currency: 'EUR',
          target_language: 'EN',
          page_no: '1',
          page_size: String(Math.min(limit - all.length, 50)),
          sort: 'SALE_PRICE_ASC',
        }) as Record<string, unknown>;

        const resp = data['aliexpress_affiliate_product_query_response'] as Record<string, unknown> | undefined;
        const result = resp?.['resp_result'] as Record<string, unknown> | undefined;
        const resultData = result?.['result'] as Record<string, unknown> | undefined;
        const products = resultData?.['products'] as Record<string, unknown> | undefined;
        const list = (products?.['product'] ?? []) as Array<Record<string, unknown>>;

        for (const p of list) {
          const price = String(p['sale_price'] ?? p['target_sale_price'] ?? '0');
          const mainImg = String(p['product_main_image_url'] ?? '');
          const smallImgs = p['product_small_image_urls'] as Record<string, unknown> | undefined;
          const extras = (smallImgs?.['string'] ?? []) as string[];

          all.push({
            externalId: String(p['product_id'] ?? ''),
            name: String(p['product_title'] ?? ''),
            costCents: Math.round(parseFloat(price) * 100),
            category: String(p['second_level_category_name'] ?? p['first_level_category_name'] ?? 'General'),
            imageUrls: [mainImg, ...extras].filter(Boolean),
          });
        }

        console.log(`[aliexpress] "${keyword}": ${list.length} results`);
      } catch (err) {
        console.error(`[aliexpress] "${keyword}" failed:`, err instanceof Error ? err.message : err);
      }

      if (keywords.indexOf(keyword) < keywords.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return all.slice(0, limit);
  }
}
