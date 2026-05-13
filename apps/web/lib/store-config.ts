import { getDbRead } from '@/lib/db';
import { tryDecryptSecret } from '@/lib/secrets';

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
  /** GA4 Measurement Protocol API secret. Server-only — never expose to client. */
  ga4ApiSecret: string | null;
  metaPixelId: string | null;
  metaCapiToken: string | null;
  tiktokPixelId: string | null;
  tiktokEventsToken: string | null;
  clarityId: string | null;
  // Google Ads Click Conversions + Merchant Center. Per-store, optional.
  googleAdsConversionAction: string | null;
  googleAdsMerchantId: string | null;
  // Mono-product mode + auto-generated assets. heroImageUrl etc. are web
  // paths starting with /generated/{slug}/run-... or null when generation
  // hasn't run / failed for that asset.
  mode: 'mono' | 'collection';
  heroImageUrl: string | null;
  cutoutImageUrl: string | null;
  lifestyleImages: string[];
  promoVideoUrl: string | null;
  assetsStatus: 'none' | 'pending' | 'generating' | 'ready' | 'error';
  // Storefront template selector (P1.4). 'auto' = derive from product count.
  template: StoreTemplate;
  // P1.1: custom domain. e.g. "maison-chic.com". Null when not configured.
  customDomain: string | null;
  // 024: structured copy for the storefront template, generated once at
  // store creation by lib/agent/landing-writer.ts. Null on legacy stores
  // that predate the column — templates fall back to generic strings.
  landingContent: LandingContent | null;
}

/**
 * Mirrors the shape used by lib/agent/landing-writer.ts. Kept loose so
 * legacy / partial fills don't break the storefront.
 */
export interface LandingContent {
  hero?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
  selling_points?: Array<{ title: string; body: string }>;
  showcase?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
  beach_moment?: {
    kicker?: string;
    headline_html?: string;
  };
  specs?: Array<{ key: string; value: string }>;
  trust_promises?: Array<{ title: string; body: string }>;
  included_items?: Array<{ qty: string; label: string }>;
  final_cta?: {
    kicker?: string;
    headline_html?: string;
    lede?: string;
  };
}

export type StoreTemplate =
  | 'auto'
  | 'mono'
  | 'collection-grid'
  | 'collection-editorial'
  | 'luxury-minimal'
  | 'gen-z-bold';

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
  ga4_api_secret: string | null;
  ga4_api_secret_enc: Buffer | null;
  ga4_api_secret_nonce: Buffer | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  meta_capi_token_enc: Buffer | null;
  meta_capi_token_nonce: Buffer | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  tiktok_events_token_enc: Buffer | null;
  tiktok_events_token_nonce: Buffer | null;
  clarity_id: string | null;
  google_ads_conversion_action: string | null;
  google_merchant_id: string | null;
  mode: 'mono' | 'collection';
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown; // JSONB — array of strings; pg returns parsed
  promo_video_url: string | null;
  assets_status: 'none' | 'pending' | 'generating' | 'ready' | 'error';
  template: StoreTemplate;
  custom_domain: string | null;
  landing_content: unknown; // JSONB — partial LandingContent or null
}

const STORE_COLUMNS = `
  id, slug, name, niche, tagline, description,
  primary_color, secondary_color, accent_color, logo_emoji,
  medusa_sales_channel_id, medusa_publishable_key, status, product_count,
  ga4_measurement_id,
  ga4_api_secret, ga4_api_secret_enc, ga4_api_secret_nonce,
  meta_pixel_id, meta_capi_token,
  meta_capi_token_enc, meta_capi_token_nonce,
  tiktok_pixel_id, tiktok_events_token,
  tiktok_events_token_enc, tiktok_events_token_nonce,
  clarity_id,
  google_ads_conversion_action, google_merchant_id,
  mode, hero_image_url, cutout_image_url, lifestyle_images,
  promo_video_url, assets_status, template,
  custom_domain, landing_content
`;

function rowToStore(r: StoreRow): StoreConfig {
  // QW4: prefer the encrypted column when present (new writes), fall back
  // to the plain column for legacy rows that predate the migration. A
  // single corrupt cipher row degrades to null rather than crashing the
  // storefront — see `tryDecryptSecret`.
  const metaCapiToken =
    tryDecryptSecret(r.meta_capi_token_enc, r.meta_capi_token_nonce) ?? r.meta_capi_token;
  const tiktokEventsToken =
    tryDecryptSecret(r.tiktok_events_token_enc, r.tiktok_events_token_nonce) ?? r.tiktok_events_token;
  const ga4ApiSecret =
    tryDecryptSecret(r.ga4_api_secret_enc, r.ga4_api_secret_nonce) ?? r.ga4_api_secret;

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
    ga4ApiSecret,
    metaPixelId: r.meta_pixel_id,
    metaCapiToken,
    tiktokPixelId: r.tiktok_pixel_id,
    tiktokEventsToken,
    clarityId: r.clarity_id,
    googleAdsConversionAction: r.google_ads_conversion_action,
    googleAdsMerchantId: r.google_merchant_id,
    mode: r.mode,
    heroImageUrl: r.hero_image_url,
    cutoutImageUrl: r.cutout_image_url,
    lifestyleImages: Array.isArray(r.lifestyle_images)
      ? (r.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
      : [],
    promoVideoUrl: r.promo_video_url,
    assetsStatus: r.assets_status,
    template: r.template,
    customDomain: r.custom_domain,
    landingContent:
      r.landing_content && typeof r.landing_content === 'object'
        ? (r.landing_content as LandingContent)
        : null,
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
  const db = getDbRead();
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
  const db = getDbRead();
  const { rows } = await db.query<StoreRow>(
    `SELECT ${STORE_COLUMNS}
     FROM dropship_stores WHERE slug = $1 AND status = 'active' LIMIT 1`,
    [slug],
  );
  return rows[0] ? rowToStore(rows[0]) : null;
}

