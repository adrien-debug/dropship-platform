import { AliExpressClient as BaseAliExpressClient, getAliExpressClient } from '@dropship/suppliers';
import type { SupplierProduct } from '@dropship/suppliers';

export type { SupplierProduct };

export class AliExpressClient extends BaseAliExpressClient {
  static create(): AliExpressClient | null {
    const client = getAliExpressClient();
    if (!client) return null;
    const appKey = process.env['ALIEXPRESS_APP_KEY'] ?? '';
    const appSecret = process.env['ALIEXPRESS_APP_SECRET'] ?? '';
    return new AliExpressClient({ appKey, appSecret });
  }

  async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
    return super.searchProducts(keywords, options);
  }
}
