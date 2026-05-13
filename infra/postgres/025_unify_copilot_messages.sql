-- 025_unify_copilot_messages.sql
-- Migrate curation and ads messages from legacy tables into the unified
-- dropship_copilot_sessions / dropship_copilot_messages tables.
--
-- Background:
--   - dropship_curation_sessions + dropship_curation_messages were the
--     original tables for the per-store curation copilot.
--   - ads-copilot (and the old standalone curation routes) reused the same
--     curation_messages table by mistake — ads sessions had no table of
--     their own.
--   - dropship_copilot_sessions + dropship_copilot_messages were created
--     for the unified hub (5 modes: research, curation, ads, medias, dev).
--   - The bug: curation-copilot.ts and ads-copilot.ts kept writing to the
--     legacy curation_messages table even when called via the hub, so
--     messages were invisible to the hub's loadHistory.
--
-- This migration:
--   1. Creates missing copilot_sessions rows for every legacy curation
--      session (mode = 'curation').
--   2. Copies all curation messages into dropship_copilot_messages.
--   3. Creates copilot_sessions rows for ads sessions that were stored
--      in curation_sessions (mode = 'ads') — we detect them by the fact
--      that they have ads-specific tool calls (list_variants, rewrite_hook,
--      generate_visual, etc.) in their message history.
--   4. Copies those ads messages into dropship_copilot_messages.
--   5. Idempotent: ON CONFLICT DO NOTHING on both tables.

-- ── Step 1: Migrate curation sessions ────────────────────────────────────

INSERT INTO dropship_copilot_sessions (id, store_id, mode, created_at, updated_at)
SELECT id, store_id, 'curation', created_at, updated_at
FROM dropship_curation_sessions
ON CONFLICT (id) DO NOTHING;

-- ── Step 2: Migrate curation messages ────────────────────────────────────

INSERT INTO dropship_copilot_messages
  (id, session_id, role, content, tool_name, tool_input, tool_output, created_at)
SELECT id, session_id, role, content, tool_name, tool_input, tool_output, created_at
FROM dropship_curation_messages
ON CONFLICT (id) DO NOTHING;

-- ── Step 3: Detect ads sessions among curation_sessions ──────────────────
-- A session is considered "ads" if it contains at least one message with
-- an ads-specific tool_name. This heuristic catches sessions that were
-- created before the unified hub existed but were actually ads conversations.

INSERT INTO dropship_copilot_sessions (id, store_id, mode, created_at, updated_at)
SELECT cs.id, cs.store_id, 'ads', cs.created_at, cs.updated_at
FROM dropship_curation_sessions cs
WHERE EXISTS (
  SELECT 1 FROM dropship_curation_messages cm
  WHERE cm.session_id = cs.id
    AND cm.tool_name IN (
      'list_variants', 'list_products', 'rewrite_hook',
      'generate_visual', 'suggest_targeting', 'estimate_budget',
      'publish_to_meta', 'publish_to_tiktok', 'publish_to_google'
    )
)
  -- Exclude sessions already migrated as curation in step 1.
  -- The ON CONFLICT below handles the race, but this WHERE avoids the
  -- unnecessary work of inserting rows we know will conflict.
  AND NOT EXISTS (
    SELECT 1 FROM dropship_copilot_sessions cps
    WHERE cps.id = cs.id
  )
ON CONFLICT (id) DO UPDATE SET mode = 'ads';

-- ── Step 4: All curation_messages are now in copilot_messages ────────────
-- (already done in step 2, which is idempotent)

-- ── Step 5: Update the mode on sessions that were mis-detected as curation ─
-- If a session has BOTH curation and ads tools, we keep 'curation' as the
-- safer default (the operator may have switched modes mid-conversation).
-- Only sessions that have ZERO curation tools get flipped to 'ads'.

UPDATE dropship_copilot_sessions cps
SET mode = 'ads'
WHERE cps.mode = 'curation'
  AND EXISTS (
    SELECT 1 FROM dropship_copilot_messages cm
    WHERE cm.session_id = cps.id
      AND cm.tool_name IN (
        'list_variants', 'list_products', 'rewrite_hook',
        'generate_visual', 'suggest_targeting', 'estimate_budget',
        'publish_to_meta', 'publish_to_tiktok', 'publish_to_google'
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM dropship_copilot_messages cm
    WHERE cm.session_id = cps.id
      AND cm.tool_name IN (
        'search_products', 'list_current_products', 'add_product',
        'remove_product', 'update_product_price', 'rewrite_product_copy'
      )
  );
