-- 029_super_agent_messages.sql
-- Persist Super Agent conversations in the existing copilot tables.
--
-- The Super Agent is the universal floating panel (SuperAgentOverlay) that
-- runs from ANY admin page, not just per-store routes. To reuse the existing
-- dropship_copilot_sessions / dropship_copilot_messages plumbing we need two
-- relaxations:
--
--   1. store_id must be nullable — the agent can be invoked from /admin
--      (no current store) so the session has no store binding.
--   2. mode CHECK must accept 'super' — a new value alongside the existing
--      five per-store modes.
--
-- Idempotent (re-runnable). Down migration removes super sessions and reverts
-- the CHECK; it leaves store_id nullable to avoid breaking other rows.

ALTER TABLE dropship_copilot_sessions
  ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE dropship_copilot_sessions
  DROP CONSTRAINT IF EXISTS dropship_copilot_sessions_mode_check;

ALTER TABLE dropship_copilot_sessions
  ADD CONSTRAINT dropship_copilot_sessions_mode_check
  CHECK (mode IN ('research','curation','ads','medias','dev','super'));

-- Recent-super lookup for the history dropdown; partial index keeps it tiny
-- (the per-store modes already have idx_copilot_sessions_store_mode).
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_super_recent
  ON dropship_copilot_sessions (updated_at DESC)
  WHERE mode = 'super';
