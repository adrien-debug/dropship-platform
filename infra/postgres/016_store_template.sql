-- P1.4: storefront template selector.
--
-- Three explicit templates plus 'auto' (current behavior):
--   - 'auto'                 : 1 product → mono, 2+ → collection-grid (legacy)
--   - 'mono'                 : MonoProductLanding.tsx (DTC long form)
--   - 'collection-grid'      : 4-col product grid
--   - 'collection-editorial' : narrative 3-6 products, alternating sections
--
-- The default is 'auto' so existing stores keep their current rendering.
-- Operators flip a store to 'collection-editorial' from the admin store
-- detail page when the niche fits a slower, story-driven sell.
--
-- Idempotent.

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'auto'
    CHECK (template IN ('auto', 'mono', 'collection-grid', 'collection-editorial'));

CREATE INDEX IF NOT EXISTS dropship_stores_template_idx
  ON dropship_stores(template)
  WHERE template <> 'auto';

COMMENT ON COLUMN dropship_stores.template IS
  'P1.4 — storefront layout selector. auto = derive from product count.';
