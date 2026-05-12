-- 022_ad_campaigns.sql
-- P1.5 — push ad variants to Meta / TikTok / Google as real campaigns + log
-- the push payload/response so we can debug rejections and attribute funnel
-- events back to the campaign via a deterministic utm_campaign naming.
--
-- 1) ALTER the existing dropship_ad_variants table to carry targeting JSON.
-- 2) CREATE dropship_ad_campaigns: one row per push attempt (draft → live).
--
-- Idempotent.

ALTER TABLE dropship_ad_variants
  ADD COLUMN IF NOT EXISTS targeting_json JSONB;

CREATE TABLE IF NOT EXISTS dropship_ad_campaigns (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID         NOT NULL REFERENCES dropship_stores(id) ON DELETE CASCADE,
  variant_id       UUID         NOT NULL REFERENCES dropship_ad_variants(id) ON DELETE CASCADE,
  channel          TEXT         NOT NULL CHECK (channel IN ('meta','tiktok','google')),
  external_id      TEXT,                       -- ad/adset/campaign id returned by the channel
  status           TEXT         NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','queued','live','paused','error')),
  daily_budget_eur NUMERIC(10,2),
  targeting_json   JSONB,
  push_payload     JSONB,                      -- exact payload we sent (debug)
  push_response    JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  pushed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_store
  ON dropship_ad_campaigns(store_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_variant
  ON dropship_ad_campaigns(variant_id);

COMMENT ON TABLE dropship_ad_campaigns IS
  'P1.5 Phase 1 — campaign push log per ad variant per channel.';
