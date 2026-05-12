-- 019_asset_runs.down.sql
DROP INDEX IF EXISTS idx_dropship_asset_runs_current;
DROP INDEX IF EXISTS idx_dropship_asset_runs_store;
DROP TABLE IF EXISTS dropship_asset_runs;
