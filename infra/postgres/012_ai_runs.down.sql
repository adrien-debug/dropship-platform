-- DOWN migration for 012_ai_runs.sql.
DROP INDEX IF EXISTS dropship_ai_runs_errors_idx;
DROP INDEX IF EXISTS dropship_ai_runs_step_idx;
DROP INDEX IF EXISTS dropship_ai_runs_store_idx;
DROP INDEX IF EXISTS dropship_ai_runs_created_idx;
DROP TABLE IF EXISTS dropship_ai_runs;
