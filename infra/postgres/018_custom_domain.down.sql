-- 018_custom_domain.down.sql
DROP INDEX IF EXISTS idx_dropship_stores_custom_domain;
ALTER TABLE dropship_stores DROP COLUMN IF EXISTS custom_domain;
