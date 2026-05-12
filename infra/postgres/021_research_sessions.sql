-- 021_research_sessions.sql
-- Pre-creation niche research copilot — persisted chat sessions.
--
-- Unlike dropship_curation_sessions, these sessions are NOT scoped to a
-- store: they exist precisely because no store has been created yet. The
-- operator iterates with Claude + web tools (Tavily, Perplexity), Meta
-- Ads Library, and supplier search to converge on a niche, then commits
-- it via the existing /admin/stores/new form.
--
-- Schema mirrors curation_messages: append-only rows with role +
-- structured tool input/output JSONB, so the UI can replay rich cards
-- (search results grids, perplexity citations, meta saturation gauge,
-- AE/CJ tables) without re-running expensive tool calls.

CREATE TABLE IF NOT EXISTS dropship_research_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,                              -- auto-generated from first user message
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dropship_research_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES dropship_research_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content     TEXT NOT NULL,
  tool_name   TEXT,
  tool_input  JSONB,
  tool_output JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_sessions_updated
  ON dropship_research_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_messages_session
  ON dropship_research_messages(session_id, created_at ASC);
