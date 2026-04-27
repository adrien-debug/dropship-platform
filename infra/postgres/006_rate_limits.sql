-- Lightweight rate-limiting backed by Postgres so we don't need Redis.
-- One row per (key, bucket) where bucket = floor(epoch_seconds / window_seconds).
-- An UPSERT bumps the count atomically; the helper trims old buckets opportunistically.

CREATE TABLE IF NOT EXISTS dropship_rate_limits (
  key      TEXT     NOT NULL,
  bucket   BIGINT   NOT NULL,
  count    INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket)
);

-- Used by the cleanup query in lib/rate-limit.ts to drop expired buckets cheaply.
CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket ON dropship_rate_limits(bucket);
