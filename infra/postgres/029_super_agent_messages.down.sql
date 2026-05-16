-- 029_super_agent_messages.down.sql
-- Destructive: removes every super-mode session (and their messages via
-- ON DELETE CASCADE on dropship_copilot_messages.session_id). Only run on a
-- fresh schema or when you have already exported the conversations.

DELETE FROM dropship_copilot_sessions WHERE mode = 'super';

ALTER TABLE dropship_copilot_sessions
  DROP CONSTRAINT IF EXISTS dropship_copilot_sessions_mode_check;

ALTER TABLE dropship_copilot_sessions
  ADD CONSTRAINT dropship_copilot_sessions_mode_check
  CHECK (mode IN ('research','curation','ads','medias','dev'));

DROP INDEX IF EXISTS idx_copilot_sessions_super_recent;

-- Note: we intentionally leave store_id nullable. Re-adding NOT NULL would
-- break if any row already had a null store_id from another path.
