import { getDb } from '@/lib/db';

export interface StoreConfig {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoEmoji: string;
  medusaSalesChannelId: string;
  medusaPublishableKey: string;
  status: string;
  productCount: number;
}

export async function getStoreBySlug(slug: string): Promise<StoreConfig | null> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string; slug: string; name: string; niche: string; tagline: string;
    description: string; primary_color: string; secondary_color: string;
    accent_color: string; logo_emoji: string; medusa_sales_channel_id: string;
    medusa_publishable_key: string; status: string; product_count: number;
  }>(
    `SELECT id, slug, name, niche, tagline, description,
            primary_color, secondary_color, accent_color, logo_emoji,
            medusa_sales_channel_id, medusa_publishable_key, status, product_count
     FROM dropship_stores WHERE slug = $1 AND status = 'active' LIMIT 1`,
    [slug],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    niche: r.niche,
    tagline: r.tagline || '',
    description: r.description || '',
    primaryColor: r.primary_color,
    secondaryColor: r.secondary_color,
    accentColor: r.accent_color,
    logoEmoji: r.logo_emoji,
    medusaSalesChannelId: r.medusa_sales_channel_id,
    medusaPublishableKey: r.medusa_publishable_key,
    status: r.status,
    productCount: r.product_count,
  };
}
