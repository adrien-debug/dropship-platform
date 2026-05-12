-- 020_curation_sessions.sql
-- Conversational curation copilot: persisted chat sessions per store.
--
-- One row in dropship_curation_sessions = one back-and-forth thread the
-- operator opens against a store. Messages are append-only (role = user,
-- assistant, or tool). Tool messages carry structured input/output (the
-- raw tool_use / tool_result blocks from Anthropic) so the UI can render
-- rich cards (search results grid, add/remove diffs, copy rewrite
-- before/after) without re-running the tool.

CREATE TABLE IF NOT EXISTS dropship_curation_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES dropship_stores(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curation_sessions_store
  ON dropship_curation_sessions(store_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS dropship_curation_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES dropship_curation_sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content       TEXT NOT NULL,
  tool_name     TEXT,           -- e.g. 'search_products', 'add_product', 'remove_product', 'update_product_price'
  tool_input    JSONB,
  tool_output   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curation_messages_session
  ON dropship_curation_messages(session_id, created_at ASC);
