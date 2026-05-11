-- QW4: encrypt per-store API tokens at rest.
--
-- Adds AES-256-GCM ciphertext + nonce columns next to the existing plain
-- text token columns on dropship_stores. The plain columns are kept for
-- one release as a rollback path, then dropped in a follow-up migration
-- once every row is fully encrypted and verified.
--
-- Read path (lib/store-config.ts) prefers the encrypted columns and
-- decrypts on the fly; it falls back to the plain columns for rows that
-- predate this migration and haven't been re-encrypted yet.
--
-- Write path (PATCH /api/agent/stores/[id]) always encrypts on the new
-- columns and NULLs the plain columns at the same time.
--
-- Idempotent. Re-running is safe.

ALTER TABLE dropship_stores
  ADD COLUMN IF NOT EXISTS meta_capi_token_enc       bytea,
  ADD COLUMN IF NOT EXISTS meta_capi_token_nonce     bytea,
  ADD COLUMN IF NOT EXISTS tiktok_events_token_enc   bytea,
  ADD COLUMN IF NOT EXISTS tiktok_events_token_nonce bytea;
