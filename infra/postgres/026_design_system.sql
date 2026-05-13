-- 026_design_system.sql
-- Locked design system per store: the agent proposes 3 presets in the chat,
-- the user picks one, and that choice is FROZEN. Every component (storefront,
-- emails, ad creatives) reads from these two columns instead of inventing
-- new colors or fonts on the fly.
--
-- design_preset: slug pointing at one of the curated presets in
--   apps/web/lib/design/presets.ts. Drives font pairing + tone defaults.
--
-- palette: structured colors decided once at creation time and never
--   regenerated. Shape:
-- {
--   "primary":   "#0a0a0a",
--   "accent":    "#ff5d2a",
--   "bg":        "#fafaf7",
--   "surface":   "#ffffff",
--   "text":      "#0a0a0a",
--   "text_muted":"#6b6b6b",
--   "border":    "#e7e5e0",
--   "success":   "#16a34a",
--   "danger":    "#dc2626"
-- }
--
-- The legacy `primary_color` / `accent_color` columns stay as-is for
-- backward compat but new code should prefer `palette`. A simple seed query
-- backfills palette for existing rows using their old colors.

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS design_preset text,
  ADD COLUMN IF NOT EXISTS palette       jsonb;

COMMENT ON COLUMN dropship_stores.design_preset IS
  'Slug of a curated design preset (see apps/web/lib/design/presets.ts). Drives font pairing.';
COMMENT ON COLUMN dropship_stores.palette IS
  'Locked color palette decided once by the agent + user. Source of truth for all UI.';

-- Backfill: existing stores get a default editorial preset + a palette
-- derived from their legacy primary/accent so the storefront keeps rendering.
UPDATE dropship_stores
SET design_preset = COALESCE(design_preset, 'editorial-serif'),
    palette = COALESCE(palette, jsonb_build_object(
      'primary',    primary_color,
      'accent',     accent_color,
      'bg',         '#fafaf7',
      'surface',    '#ffffff',
      'text',       '#0a0a0a',
      'text_muted', '#6b6b6b',
      'border',     '#e7e5e0',
      'success',    '#16a34a',
      'danger',     '#dc2626'
    ))
WHERE design_preset IS NULL OR palette IS NULL;
