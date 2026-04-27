-- Replace the unique index so it also blocks a concurrent "sending" attempt:
-- the row is INSERTed with status='sending' BEFORE we call AliExpress, used as
-- a distributed lock. A second concurrent live send hits the unique violation
-- and bails out before placing a duplicate AE order.

DROP INDEX IF EXISTS idx_order_forwards_live_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_forwards_live_unique
  ON dropship_order_forwards(medusa_order_id)
  WHERE dry_run = false AND status IN ('sending', 'sent');
