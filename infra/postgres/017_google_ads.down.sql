-- 017_google_ads.down.sql
ALTER TABLE dropship_stores
  DROP COLUMN IF EXISTS google_ads_customer_id,
  DROP COLUMN IF EXISTS google_ads_conversion_action,
  DROP COLUMN IF EXISTS google_merchant_id;
