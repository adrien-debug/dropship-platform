-- Mono-product mode + auto-generated assets (hero, lifestyles, promo video).
--
-- mode='mono' tells the storefront to use the long-form mono-product landing
-- (currently the only template that holds up at DTC-premium quality). The
-- agent enforces a single SKU when this mode is set.
--
-- assets_* columns hold paths under apps/web/public/generated/{slug}/run-*
-- written by the asset generator after the product is selected. The landing
-- consumes these directly — no per-store hardcoded paths.

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'collection',
  ADD COLUMN IF NOT EXISTS assets_run_id TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cutout_image_url TEXT,
  ADD COLUMN IF NOT EXISTS lifestyle_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promo_video_url TEXT,
  ADD COLUMN IF NOT EXISTS assets_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_mode_check
    CHECK (mode IN ('mono', 'collection'));

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_assets_status_check
    CHECK (assets_status IN ('none', 'pending', 'generating', 'ready', 'error'));

-- Per-product image quality scoring. Stores the Claude Vision verdict so we
-- can re-rank candidates without paying for vision a second time, and so the
-- admin UI can explain *why* a product was rejected.
ALTER TABLE dropship_store_products
  ADD COLUMN IF NOT EXISTS image_quality_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS image_quality_issues JSONB DEFAULT '[]'::jsonb;
