-- DOWN migration for 015_ga4_api_secret.sql.
-- Drops the three GA4 api_secret columns added by the UP migration.
-- Storefront falls back to client-side gtag-only (no server-side dedup).

ALTER TABLE public.dropship_stores
  DROP COLUMN IF EXISTS ga4_api_secret,
  DROP COLUMN IF EXISTS ga4_api_secret_enc,
  DROP COLUMN IF EXISTS ga4_api_secret_nonce;
