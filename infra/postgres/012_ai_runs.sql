-- P0.1: AI runs ledger. Records every Anthropic call made by the agent
-- pipeline so we can track cost / latency / error rate per store, per
-- step, per model. Without this we are flying blind when multiplying
-- stores or adding new agents.
--
-- Volume order of magnitude: 1 store creation =
--   2 Claude generate / enrich calls + 1 prompt-builder + 40-50 vision
--   scoring calls = ~45 rows per store. At 100 stores / day that is
--   ~4.5k rows / day = ~1.6M rows / year. Manageable on Postgres without
--   partitioning for the first 12 months.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS dropship_ai_runs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID         NULL REFERENCES dropship_stores(id) ON DELETE SET NULL,
  step          text         NOT NULL,
  model         text         NOT NULL,
  input_tokens  integer      NOT NULL DEFAULT 0,
  output_tokens integer      NOT NULL DEFAULT 0,
  latency_ms    integer      NOT NULL DEFAULT 0,
  cost_eur      numeric(12, 6) NOT NULL DEFAULT 0,
  error_json    jsonb        NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dropship_ai_runs_created_idx
  ON dropship_ai_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS dropship_ai_runs_store_idx
  ON dropship_ai_runs(store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dropship_ai_runs_step_idx
  ON dropship_ai_runs(step, created_at DESC);

CREATE INDEX IF NOT EXISTS dropship_ai_runs_errors_idx
  ON dropship_ai_runs(created_at DESC)
  WHERE error_json IS NOT NULL;

COMMENT ON TABLE dropship_ai_runs IS
  'P0.1 Phase 1 — one row per Anthropic call. Cost in EUR (USD * exchange rate at runtime).';
