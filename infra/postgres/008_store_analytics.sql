-- Migration: per-store analytics config + funnel events table.
-- Applied to Railway Postgres.
--
-- Two distinct concerns:
--   1. Store-level config: which pixel/CAPI/Clarity IDs to inject for THIS
--      store. One row per store, edited from the admin.
--   2. Funnel events: every PageView / ViewContent / AddToCart /
--      InitiateCheckout / Purchase, persisted server-side so the admin
--      analytics dashboard can compute attribution + conversion rates
--      without hitting Meta/TikTok APIs.

-- ============================================================
-- 1. Store-level analytics config (extend existing table)
-- ============================================================
ALTER TABLE public.dropship_stores
  ADD COLUMN IF NOT EXISTS ga4_measurement_id text,
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS meta_capi_token text,        -- Meta Conversions API access token
  ADD COLUMN IF NOT EXISTS tiktok_pixel_id text,
  ADD COLUMN IF NOT EXISTS tiktok_events_token text,    -- TikTok Events API access token
  ADD COLUMN IF NOT EXISTS clarity_id text;

COMMENT ON COLUMN public.dropship_stores.ga4_measurement_id IS 'Google Analytics 4 measurement ID (G-XXXXXX). Per-store. Optional.';
COMMENT ON COLUMN public.dropship_stores.meta_pixel_id IS 'Meta Pixel ID (numeric). Per-store. Optional.';
COMMENT ON COLUMN public.dropship_stores.meta_capi_token IS 'Meta Conversions API access token. Server-side dedup. Optional, sensitive.';
COMMENT ON COLUMN public.dropship_stores.tiktok_pixel_id IS 'TikTok Pixel ID. Per-store. Optional.';
COMMENT ON COLUMN public.dropship_stores.tiktok_events_token IS 'TikTok Events API access token. Server-side dedup. Optional, sensitive.';
COMMENT ON COLUMN public.dropship_stores.clarity_id IS 'Microsoft Clarity site ID for UX session replays + heatmaps. Optional.';

-- ============================================================
-- 2. Funnel events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dropship_funnel_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_slug      text NOT NULL,
  session_id      text NOT NULL,                  -- 1st-party cookie, persists 30d
  event_name      text NOT NULL,                  -- 'page_view' | 'view_content' | 'add_to_cart' | 'initiate_checkout' | 'purchase'
  event_id        text,                           -- For Meta/TikTok client/server dedup. UUID v4. Optional.
  product_id      text,                           -- Medusa product id when relevant
  variant_id      text,
  value_minor     integer,                        -- Major-unit amount × 100 (cents). NULL until checkout.
  currency_code   text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_term        text,
  utm_content     text,
  fbclid          text,                           -- Meta click ID — required for CAPI dedup
  ttclid          text,                           -- TikTok click ID — required for Events API dedup
  referrer        text,
  user_agent      text,
  ip_hash         text,                           -- SHA-256 of IP. Never store raw IP (RGPD).
  email_hash      text,                           -- SHA-256 of email. Set on purchase, lets Meta/TikTok match w/o PII.
  phone_hash      text,                           -- SHA-256 of phone. Same logic.
  medusa_order_id text,                           -- Set on purchase
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dropship_funnel_events IS 'Per-event funnel log for attribution + conversion-rate analytics. PII is hashed before persistence (RGPD).';

CREATE INDEX IF NOT EXISTS idx_funnel_events_store_created
  ON public.dropship_funnel_events (store_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session
  ON public.dropship_funnel_events (session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name
  ON public.dropship_funnel_events (store_slug, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_utm_source
  ON public.dropship_funnel_events (store_slug, utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_funnel_events_order
  ON public.dropship_funnel_events (medusa_order_id)
  WHERE medusa_order_id IS NOT NULL;
