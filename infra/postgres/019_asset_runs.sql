-- 019_asset_runs.sql
-- P1.6 — Per-store asset regeneration history.
--
-- Each time the admin regenerates a hero / cutout / lifestyle / promo, we
-- write a row here. The row carries the prompt used, the product reference
-- image at that moment, the resulting URL (R2 absolute or filesystem path),
-- and a status. The `is_current` flag marks the run whose URL currently
-- backs the matching column in `dropship_stores` — exactly one current
-- run per (store, asset_kind) at any time. Setting an older run "as
-- current" toggles the flag and updates the store columns in one shot,
-- giving the admin one-click rollback to a previous render.
--
-- `asset_kind = 'all'` is reserved for batch runs (the initial mono-asset
-- pipeline at store creation, eventually); per-slot runs use the explicit
-- 'hero' / 'cutout' / 'lifestyle-1..3' / 'promo' values.

CREATE TABLE IF NOT EXISTS dropship_asset_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES dropship_stores(id) ON DELETE CASCADE,
  asset_kind          TEXT NOT NULL CHECK (asset_kind IN ('hero','cutout','lifestyle-1','lifestyle-2','lifestyle-3','promo','all')),
  prompt              TEXT,
  reference_image_url TEXT,
  result_url          TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','success','error')),
  error_message       TEXT,
  comfy_run_id        TEXT,
  is_current          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dropship_asset_runs_store
  ON dropship_asset_runs (store_id, asset_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dropship_asset_runs_current
  ON dropship_asset_runs (store_id, asset_kind)
  WHERE is_current = true;
