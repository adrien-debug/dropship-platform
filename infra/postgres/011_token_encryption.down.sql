-- DOWN migration for 011_token_encryption.sql.
-- Drops the four ciphertext / nonce columns. The plain columns
-- (meta_capi_token, tiktok_events_token) are untouched — they remain the
-- single source of truth after rollback.

ALTER TABLE dropship_stores
  DROP COLUMN IF EXISTS meta_capi_token_enc,
  DROP COLUMN IF EXISTS meta_capi_token_nonce,
  DROP COLUMN IF EXISTS tiktok_events_token_enc,
  DROP COLUMN IF EXISTS tiktok_events_token_nonce;
