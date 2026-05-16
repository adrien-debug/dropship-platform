-- 028_encrypt_aliexpress_tokens.sql
-- Add encrypted-value columns to platform_settings so OAuth tokens
-- (AliExpress, and any future provider) can be stored encrypted at rest.
--
-- Why not a separate table? platform_settings is intentionally a simple
-- key/value bag; adding two columns keeps the shape flat and lets every
-- row opt-in to encryption without schema changes per provider.
--
-- The read path tries value_enc/value_nonce first, then falls back to
-- the plain value column for legacy rows during the transition window.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS value_enc BYTEA,
  ADD COLUMN IF NOT EXISTS value_nonce BYTEA;

-- Partial index so encrypted lookups are fast.
CREATE INDEX IF NOT EXISTS idx_platform_settings_enc
  ON platform_settings(key)
  WHERE value_enc IS NOT NULL;
