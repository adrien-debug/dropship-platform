-- AliExpress n'a pas d'API publique pour payer une commande dropshipping créée
-- via ds.order.create — le marchand doit aller cliquer "Payer" sur aliexpress.com.
-- On garde donc une trace manuelle : null tant que pas payée, timestamp une fois
-- que le user a cliqué "Marquer payée" depuis l'admin (ou qu'on aura branché
-- aliexpress.ds.order.tracking.get pour le détecter automatiquement).
ALTER TABLE dropship_order_forwards
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Sert à la liste "Commandes à payer" : status='sent' AND dry_run=false AND paid_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_order_forwards_awaiting_payment
  ON dropship_order_forwards(created_at DESC)
  WHERE status = 'sent' AND dry_run = false AND paid_at IS NULL;
