-- Add missing columns to products table for supplier sync
ALTER TABLE products ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES catalogs(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_cents int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_days_min int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_days_max int;
ALTER TABLE products ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Unique constraint for upsert by catalog + external supplier ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_catalog_external
  ON products(catalog_id, external_id) WHERE catalog_id IS NOT NULL AND external_id IS NOT NULL;

-- Add site_id to sync_logs for multi-tenant queries
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS product_count int DEFAULT 0;

-- RLS: products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_by_site'
  ) THEN
    CREATE POLICY products_by_site ON products FOR ALL USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
