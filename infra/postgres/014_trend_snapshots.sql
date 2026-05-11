-- P1.2: Trend snapshots cache for the Meta Ads Library niche validator.
--
-- The validator hits Facebook from the agent host to estimate competitive
-- saturation for a given niche before the founder burns a 25-40s store
-- creation cycle on it. Scraping is brittle (Facebook reshuffles its DOM
-- regularly) and rate-limited by IP; the deterministic Claude fallback
-- itself is not free (~$0.001 per call). We cache one row per (niche,
-- country) for `expires_at - fetched_at` (24h by default) so the admin
-- can re-poke the same niche without paying twice.
--
-- The full result envelope (saturation, advertisers, sample creatives,
-- angles, verdict, raw_snippet) lives in `payload` JSONB to keep the
-- shape forward-compatible without piling migrations.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS dropship_trend_snapshots (
  niche       text         NOT NULL,
  country     text         NOT NULL,
  payload     jsonb        NOT NULL,
  fetched_at  timestamptz  NOT NULL DEFAULT now(),
  expires_at  timestamptz  NOT NULL,
  PRIMARY KEY (niche, country)
);

CREATE INDEX IF NOT EXISTS dropship_trend_snapshots_expires_idx
  ON dropship_trend_snapshots(expires_at);

COMMENT ON TABLE dropship_trend_snapshots IS
  'P1.2 Phase 1 — Meta Ads Library niche validation cache (24h TTL by default).';
