-- Drop partial index (not usable for PostgREST upsert)
DROP INDEX IF EXISTS idx_products_catalog_external;

-- Create proper unique constraint for upsert
ALTER TABLE products ADD CONSTRAINT uq_products_catalog_external
  UNIQUE (catalog_id, external_id);

NOTIFY pgrst, 'reload schema';
