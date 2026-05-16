-- 028_encrypt_aliexpress_tokens.down.sql
-- Rollback: drop encrypted-value columns from platform_settings.
--
-- WARNING: this destroys encrypted rows. Run only if you are reverting
-- to a version of the code that does not know about value_enc/value_nonce.

DROP INDEX IF EXISTS idx_platform_settings_enc;

ALTER TABLE platform_settings
  DROP COLUMN IF EXISTS value_enc,
  DROP COLUMN IF EXISTS value_nonce;
