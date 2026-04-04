export interface SupplierProduct {
  externalId: string;
  name: string;
  description: string;
  costCents: number;
  category: string;
  imageUrls: string[];
  variants: {
    sku: string;
    name: string;
    costCents: number;
    stock: number;
    attributes: Record<string, string>;
  }[];
  shippingDays: { min: number; max: number };
}

export interface SupplierClient {
  testConnection(): Promise<boolean>;
  searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]>;
  getProduct(externalId: string): Promise<SupplierProduct | null>;
}
