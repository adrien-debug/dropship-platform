-- 018_custom_domain.sql
-- Add per-store custom domain support.
-- custom_domain: e.g. "maison-chic.com" — the apex domain the merchant points
-- to Vercel. The middleware resolves inbound requests on this host to the
-- corresponding /shop/{slug} path transparently (no redirect, URL stays clean).

ALTER TABLE dropship_stores ADD COLUMN IF NOT EXISTS custom_domain TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dropship_stores_custom_domain
  ON dropship_stores (custom_domain)
  WHERE custom_domain IS NOT NULL;
