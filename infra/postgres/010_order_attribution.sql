-- Phase 0 / QW3 — Order attribution.
--
-- Joins paid orders back to the visitor's first-touch UTM context so the
-- CAC-by-campaign + ROAS-ex-post dashboards stop being blind. The funnel
-- log (`dropship_funnel_events`) already records UTM + session_id +
-- event_id per visit and gets `medusa_order_id` stamped on the `purchase`
-- row. This migration copies those three pieces of context onto the order
-- forwarder row at the moment we actually push the order to AE — that's
-- the natural join key downstream analytics already use.
--
-- Idempotent: safe to re-run on a partially-migrated DB.

ALTER TABLE public.dropship_order_forwards
  ADD COLUMN IF NOT EXISTS attribution_json jsonb,
  ADD COLUMN IF NOT EXISTS session_id       text,
  ADD COLUMN IF NOT EXISTS event_id         text;

COMMENT ON COLUMN public.dropship_order_forwards.attribution_json IS
  'Snapshot of the visitor utm_attribution cookie at purchase time (utm_source/medium/campaign/term/content + fbclid/ttclid). Hydrated from dropship_funnel_events at forward time.';
COMMENT ON COLUMN public.dropship_order_forwards.session_id IS
  'Visitor session_id (joins dropship_funnel_events.session_id). Hydrated from dropship_funnel_events at forward time.';
COMMENT ON COLUMN public.dropship_order_forwards.event_id IS
  'Shared event UUID between dropship_funnel_events.purchase row and the Meta/TikTok client/server dedup. Hydrated from dropship_funnel_events at forward time.';

-- Partial indexes: only the populated rows are interesting for analytics
-- joins. Saves index size as long as legacy rows stay NULL.
CREATE INDEX IF NOT EXISTS idx_dropship_order_forwards_session
  ON public.dropship_order_forwards (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dropship_order_forwards_event
  ON public.dropship_order_forwards (event_id)
  WHERE event_id IS NOT NULL;

-- Best-effort backfill: existing forwards where we already have the
-- matching purchase row in the funnel log get the 3 columns populated in
-- one shot. Brand-new deployments where either table is empty silently
-- update zero rows.
UPDATE public.dropship_order_forwards f
   SET session_id       = e.session_id,
       event_id         = e.event_id,
       attribution_json = jsonb_build_object(
         'utm_source',   e.utm_source,
         'utm_medium',   e.utm_medium,
         'utm_campaign', e.utm_campaign,
         'utm_term',     e.utm_term,
         'utm_content',  e.utm_content,
         'fbclid',       e.fbclid,
         'ttclid',       e.ttclid
       )
  FROM public.dropship_funnel_events e
 WHERE f.medusa_order_id = e.medusa_order_id
   AND e.event_name      = 'purchase'
   AND f.session_id IS NULL;
