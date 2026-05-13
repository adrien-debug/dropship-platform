-- 024_landing_content.down.sql
ALTER TABLE dropship_stores
  DROP COLUMN IF EXISTS landing_content;
