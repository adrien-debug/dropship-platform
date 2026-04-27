-- Multi-tenant dropship stores
CREATE TABLE IF NOT EXISTS dropship_stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  niche       TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  primary_color    TEXT NOT NULL DEFAULT '#111827',
  secondary_color  TEXT NOT NULL DEFAULT '#f9fafb',
  accent_color     TEXT NOT NULL DEFAULT '#6366f1',
  logo_emoji       TEXT NOT NULL DEFAULT '🛍️',
  medusa_sales_channel_id  TEXT,
  medusa_publishable_key   TEXT,
  status      TEXT NOT NULL DEFAULT 'creating',
  error_message TEXT,
  product_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dropship_stores_slug   ON dropship_stores(slug);
CREATE INDEX IF NOT EXISTS idx_dropship_stores_status ON dropship_stores(status);

-- Products linked to a store (enriched by agent)
CREATE TABLE IF NOT EXISTS dropship_store_products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES dropship_stores(id) ON DELETE CASCADE,
  medusa_product_id   TEXT,
  supplier            TEXT NOT NULL,
  external_id         TEXT NOT NULL,
  original_title      TEXT NOT NULL,
  enriched_title      TEXT NOT NULL,
  enriched_description TEXT NOT NULL,
  price_cents         INTEGER NOT NULL,
  cost_cents          INTEGER NOT NULL,
  image_url           TEXT,
  supplier_url        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, supplier, external_id)
);

CREATE INDEX IF NOT EXISTS idx_store_products_store ON dropship_store_products(store_id);
