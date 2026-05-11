-- DOWN migration for 013_ad_variants.sql.
DROP INDEX IF EXISTS dropship_ad_variants_batch_idx;
DROP INDEX IF EXISTS dropship_ad_variants_product_idx;
DROP INDEX IF EXISTS dropship_ad_variants_store_idx;
DROP TABLE IF EXISTS dropship_ad_variants;
