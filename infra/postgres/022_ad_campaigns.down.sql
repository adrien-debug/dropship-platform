-- DOWN migration for 022_ad_campaigns.sql.
DROP INDEX IF EXISTS idx_ad_campaigns_variant;
DROP INDEX IF EXISTS idx_ad_campaigns_store;
DROP TABLE IF EXISTS dropship_ad_campaigns;
ALTER TABLE dropship_ad_variants DROP COLUMN IF EXISTS targeting_json;
