export type SupplierType = 'cjdropshipping' | 'aliexpress' | 'shopify' | 'custom';
export type SupplierStatus = 'connected' | 'disconnected' | 'error';
export type SiteStatus = 'draft' | 'deploying' | 'live' | 'paused';
export type SyncStatus = 'running' | 'success' | 'failed';
export type CampaignPlatform = 'google_ads' | 'meta' | 'tiktok';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';
export type ProductSort = 'price_asc' | 'price_desc' | 'new' | 'popular' | 'random';
export type StockFilter = 'all' | 'in_stock' | 'out_of_stock';
export type LayoutMode = 'grid' | 'list';

export interface SiteConfig {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  coolifyAppId: string | null;
  medusaSalesChannelId: string | null;
  status: SiteStatus;
  theme: {
    brand?: string;
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    logo?: string;
  };
  config: {
    locale?: string;
    currency?: string;
    ga4Id?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CatalogConfig {
  id: string;
  siteId: string;
  name: string;
  supplier: SupplierType;
  keywords: string[];
  margin: number;
  minPrice: number | null;
  maxPrice: number | null;
  autoSync: boolean;
  syncCron: string;
  productCount: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  siteId: string;
  platform: CampaignPlatform;
  externalId: string | null;
  name: string;
  dailyBudget: number | null;
  status: CampaignStatus;
  targeting: Record<string, unknown>;
  creatives: Record<string, unknown>;
  metrics: Record<string, unknown>;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  catalogId: string;
  status: SyncStatus;
  productsFound: number;
  productsAdded: number;
  productsUpdated: number;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface SupplierCredentials {
  cjdropshipping: { apiKey: string };
  aliexpress: { appKey: string; appSecret: string; trackingId: string };
  shopify: { storeDomain: string; storefrontToken: string; adminToken: string };
  custom: { apiUrl: string; apiKey: string };
}

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  costCents?: number;
  category: string;
  inStock: boolean;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  supplier?: string;
  supplierId?: string;
  shippingDays?: { min: number; max: number };
  seoTitle?: string;
  seoDescription?: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  costCents: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ProductListResponse {
  items: ProductDto[];
  total: number;
  page: number;
  limit: number;
}
