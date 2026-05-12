-- 023_copilot_sessions.down.sql
-- Drops the unified Copilote hub tables and their indexes. Messages cascade
-- via FK; the sessions table is dropped last.

DROP INDEX IF EXISTS idx_copilot_messages_session;
DROP TABLE IF EXISTS dropship_copilot_messages;
DROP INDEX IF EXISTS idx_copilot_sessions_store_mode;
DROP TABLE IF EXISTS dropship_copilot_sessions;
