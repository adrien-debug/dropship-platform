-- DOWN migration for 014_trend_snapshots.sql.
DROP INDEX IF EXISTS dropship_trend_snapshots_expires_idx;
DROP TABLE IF EXISTS dropship_trend_snapshots;
