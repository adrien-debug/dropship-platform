-- Reverse 027_template_editorial_fashion.sql — restore the legacy CHECK
-- (the four original templates from migration 016). Any rows whose template
-- column drifted out of that set will block the DROP; clean them first.

ALTER TABLE dropship_stores
  DROP CONSTRAINT IF EXISTS dropship_stores_template_check;

ALTER TABLE dropship_stores
  ADD CONSTRAINT dropship_stores_template_check
  CHECK (template IN (
    'auto',
    'mono',
    'collection-grid',
    'collection-editorial'
  ));
