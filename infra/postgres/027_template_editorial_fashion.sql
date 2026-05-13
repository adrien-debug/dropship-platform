-- 027_template_editorial_fashion.sql
-- Extend the dropship_stores.template CHECK constraint so the new
-- storefront layouts ported from Wix can be persisted on a store.
--
-- The original migration (016_store_template.sql) only listed the first
-- four templates; subsequent additions (`luxury-minimal`, `gen-z-bold`,
-- `editorial-fashion`, and now `wellness-soft`) are folded in here so the
-- constraint matches the StoreTemplate union in
-- apps/web/lib/store-config.ts.
--
-- Idempotent: drops the old constraint (whatever its current shape) before
-- recreating with the full template set.

ALTER TABLE dropship_stores
  DROP CONSTRAINT IF EXISTS dropship_stores_template_check;

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_template_check
  CHECK (template IN (
    'auto',
    'mono',
    'collection-grid',
    'collection-editorial',
    'luxury-minimal',
    'gen-z-bold',
    'editorial-fashion',
    'wellness-soft'
  ));
