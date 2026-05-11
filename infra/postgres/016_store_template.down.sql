DROP INDEX IF EXISTS dropship_stores_template_idx;
ALTER TABLE dropship_stores DROP COLUMN IF EXISTS template;
