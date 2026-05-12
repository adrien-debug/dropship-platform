-- 020_curation_sessions.down.sql
DROP INDEX IF EXISTS idx_curation_messages_session;
DROP TABLE IF EXISTS dropship_curation_messages;
DROP INDEX IF EXISTS idx_curation_sessions_store;
DROP TABLE IF EXISTS dropship_curation_sessions;
