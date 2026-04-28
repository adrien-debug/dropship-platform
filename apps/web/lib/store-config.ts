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
  // Analytics IDs — all optional, all per-store. Public ones (pixel /
  // measurement / clarity) are safe to send to the client bundle. The two
  // *_token fields are server-only — never pass them to a client component.
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  metaCapiToken: string | null;
  tiktokPixelId: string | null;
  tiktokEventsToken: string | null;
  clarityId: string | null;
}

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  tagline: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_emoji: string;
  medusa_sales_channel_id: string;
  medusa_publishable_key: string;
  status: string;
  product_count: number;
  ga4_measurement_id: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
}

const STORE_COLUMNS = `
  id, slug, name, niche, tagline, description,
  primary_color, secondary_color, accent_color, logo_emoji,
  medusa_sales_channel_id, medusa_publishable_key, status, product_count,
  ga4_measurement_id, meta_pixel_id, meta_capi_token,
  tiktok_pixel_id, tiktok_events_token, clarity_id
`;

function rowToStore(r: StoreRow): StoreConfig {
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
    ga4MeasurementId: r.ga4_measurement_id,
    metaPixelId: r.meta_pixel_id,
    metaCapiToken: r.meta_capi_token,
    tiktokPixelId: r.tiktok_pixel_id,
    tiktokEventsToken: r.tiktok_events_token,
    clarityId: r.clarity_id,
  };
}

/**
 * Public analytics IDs only — safe to pass to client components. Use this
 * shape whenever the storefront needs to inject pixels in client bundles
 * without leaking the CAPI / Events API tokens.
 */
export interface StorePublicAnalytics {
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  clarityId: string | null;
}

export function publicAnalytics(store: StoreConfig): StorePublicAnalytics {
  return {
    ga4MeasurementId: store.ga4MeasurementId,
    metaPixelId: store.metaPixelId,
    tiktokPixelId: store.tiktokPixelId,
    clarityId: store.clarityId,
  };
}

export async function getStoreBySalesChannelId(salesChannelId: string): Promise<StoreConfig | null> {
  const db = getDb();
  const { rows } = await db.query<StoreRow>(
    `SELECT ${STORE_COLUMNS}
     FROM dropship_stores
     WHERE medusa_sales_channel_id = $1 AND status = 'active'
     LIMIT 1`,
    [salesChannelId],
  );
  return rows[0] ? rowToStore(rows[0]) : null;
}

export async function getStoreBySlug(slug: string): Promise<StoreConfig | null> {
  const db = getDb();
  const { rows } = await db.query<StoreRow>(
    `SELECT ${STORE_COLUMNS}
     FROM dropship_stores WHERE slug = $1 AND status = 'active' LIMIT 1`,
    [slug],
  );
  return rows[0] ? rowToStore(rows[0]) : null;
}
