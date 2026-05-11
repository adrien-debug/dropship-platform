-- P1 GA4 server-side: per-store GA4 Measurement Protocol API secret.
--
-- Adds the GA4 MP api_secret column on dropship_stores so we can POST
-- server-side events to the Measurement Protocol endpoint, in parallel
-- with the existing Meta CAPI + TikTok Events forwarders.
--
-- Mirrors the QW4 encryption pattern: a legacy plain text column kept as
-- a one-release rollback path, plus the AES-256-GCM ciphertext + nonce
-- pair that the write path (PATCH /api/agent/stores/[id]) populates. The
-- read path (lib/store-config.ts) prefers the encrypted columns and falls
-- back to the plain one for any row that predates the encrypted write.
--
-- Idempotent. Re-running is safe.

ALTER TABLE public.dropship_stores
  ADD COLUMN IF NOT EXISTS ga4_api_secret        text  NULL,
  ADD COLUMN IF NOT EXISTS ga4_api_secret_enc    bytea NULL,
  ADD COLUMN IF NOT EXISTS ga4_api_secret_nonce  bytea NULL;

COMMENT ON COLUMN public.dropship_stores.ga4_api_secret IS 'GA4 Measurement Protocol API secret. Server-side dedup with gtag client. Optional, sensitive. Legacy plain column — new writes encrypt to ga4_api_secret_enc.';
COMMENT ON COLUMN public.dropship_stores.ga4_api_secret_enc IS 'AES-256-GCM ciphertext (auth tag appended) of the GA4 MP api_secret.';
COMMENT ON COLUMN public.dropship_stores.ga4_api_secret_nonce IS '12-byte GCM nonce for ga4_api_secret_enc.';
