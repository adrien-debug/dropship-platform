-- 017_google_ads.sql
-- Add Google Ads & Merchant Center columns to dropship_stores.
-- google_ads_customer_id  : per-store CID (may differ from main account in MCC setups)
-- google_ads_conversion_action : full resource name, e.g.
--   customers/2877134493/conversionActions/123456789
-- google_merchant_id : Merchant Center account ID for Shopping feeds

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS google_ads_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_action TEXT,
  ADD COLUMN IF NOT EXISTS google_merchant_id           TEXT;
