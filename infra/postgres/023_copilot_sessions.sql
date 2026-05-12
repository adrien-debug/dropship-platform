-- 023_copilot_sessions.sql
-- Per-store unified Copilote hub: one chat surface, five modes (research,
-- curation, ads, medias, dev). Each session belongs to a store + mode so the
-- UI can flip modes inside the same hub and the history strip stays scoped.
--
-- Why a new table instead of reusing dropship_curation_sessions:
--   - the older table is store-only (no mode), reused implicitly by ads
--   - research lives on its own table with no store FK
--   - the new hub wants ONE chronologically merged feed per (store, mode)
-- Persisting all five modes in this single table makes session listing
-- trivial (a WHERE store_id AND mode), avoids duplicate plumbing across the
-- legacy tables, and gives the Dev mode a place to live without polluting
-- the curation/ads schema (which is product-bound).

CREATE TABLE IF NOT EXISTS dropship_copilot_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES dropship_stores(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL CHECK (mode IN ('research','curation','ads','medias','dev')),
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_store_mode
  ON dropship_copilot_sessions(store_id, mode, updated_at DESC);

CREATE TABLE IF NOT EXISTS dropship_copilot_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES dropship_copilot_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content     TEXT NOT NULL,
  tool_name   TEXT,
  tool_input  JSONB,
  tool_output JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session
  ON dropship_copilot_messages(session_id, created_at ASC);
