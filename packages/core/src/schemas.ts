import { z } from 'zod';

export const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  domain: z.string().url().nullable().optional(),
  theme: z.object({
    brand: z.string().optional(),
    colors: z.record(z.string()).optional(),
    fonts: z.record(z.string()).optional(),
    logo: z.string().url().optional(),
  }).optional(),
  config: z.object({
    locale: z.string().default('fr'),
    currency: z.string().default('EUR'),
    ga4Id: z.string().optional(),
  }).optional(),
});

export const createCatalogSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(100),
  supplier: z.enum(['cjdropshipping', 'aliexpress', 'shopify', 'custom']),
  keywords: z.array(z.string()).min(1),
  margin: z.number().int().min(0).max(500).default(100),
  minPrice: z.number().int().min(0).nullable().optional(),
  maxPrice: z.number().int().min(0).nullable().optional(),
  autoSync: z.boolean().default(true),
  syncCron: z.string().default('0 */6 * * *'),
});

export const createCampaignSchema = z.object({
  siteId: z.string().uuid(),
  platform: z.enum(['google_ads', 'meta', 'tiktok']),
  name: z.string().min(1).max(200),
  dailyBudget: z.number().int().min(100).nullable().optional(),
  targeting: z.record(z.unknown()).optional(),
  creatives: z.record(z.unknown()).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type CreateCatalogInput = z.infer<typeof createCatalogSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
