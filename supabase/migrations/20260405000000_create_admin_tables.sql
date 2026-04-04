CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  domain text,
  coolify_app_id text,
  medusa_sales_channel_id text,
  status text NOT NULL DEFAULT 'draft',
  theme jsonb DEFAULT '{}',
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  supplier text NOT NULL DEFAULT 'cjdropshipping',
  keywords text[] DEFAULT '{}',
  margin int DEFAULT 100,
  min_price int,
  max_price int,
  auto_sync boolean DEFAULT true,
  sync_cron text DEFAULT '0 */6 * * *',
  product_count int DEFAULT 0,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text,
  name text NOT NULL,
  daily_budget int,
  status text NOT NULL DEFAULT 'draft',
  targeting jsonb DEFAULT '{}',
  creatives jsonb DEFAULT '{}',
  metrics jsonb DEFAULT '{}',
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES catalogs(id) ON DELETE CASCADE,
  status text NOT NULL,
  products_found int DEFAULT 0,
  products_added int DEFAULT 0,
  products_updated int DEFAULT 0,
  error text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
