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

/** Normalized product shape for cross-supplier use */
export interface RouterProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  cost: number;
  image: string;
  images: string[];
  supplier: 'cjdropshipping' | 'aliexpress';
  supplierProductId: string;
  category: string;
  variants?: Array<{ name: string; values: string[] }>;
}

export interface SupplierSearchParams {
  keywords: string;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  preferredSuppliers?: Array<'cjdropshipping' | 'aliexpress'>;
}
