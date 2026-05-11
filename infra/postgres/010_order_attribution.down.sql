-- DOWN script for 010_order_attribution.sql
--
-- Drops the two partial indexes first (they reference the columns),
-- then the three columns. Idempotent: each DROP is guarded.

DROP INDEX IF EXISTS public.idx_dropship_order_forwards_event;
DROP INDEX IF EXISTS public.idx_dropship_order_forwards_session;

ALTER TABLE public.dropship_order_forwards
  DROP COLUMN IF EXISTS event_id,
  DROP COLUMN IF EXISTS session_id,
  DROP COLUMN IF EXISTS attribution_json;
