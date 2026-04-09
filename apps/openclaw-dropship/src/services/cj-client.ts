import { CJDropshippingClient, type SupplierProduct } from '@dropship/suppliers';

export type { SupplierProduct };

export class CJClient {
  private client: CJDropshippingClient;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['CJ_API_KEY'] ?? process.env['CJ_DROPSHIPPING_API_KEY'] ?? '';
    this.client = new CJDropshippingClient({ apiKey: key });
  }

  async searchProducts(query: string, _page = 1, limit = 20): Promise<SupplierProduct[]> {
    return this.client.searchProducts([query], { limit });
  }

  async getProductDetail(pid: string): Promise<SupplierProduct | null> {
    return this.client.getProduct(pid);
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }
}
