-- Tracking des commandes Medusa forwardées vers AliExpress
-- Une ligne par tentative ; on garde l'historique des dry-runs et des envois live.
CREATE TABLE IF NOT EXISTS dropship_order_forwards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medusa_order_id     TEXT NOT NULL,
  store_id            UUID REFERENCES dropship_stores(id) ON DELETE SET NULL,
  ae_order_id         TEXT,                 -- rempli après ds.order.create OK
  payload             JSONB NOT NULL,       -- ce qu'on a envoyé (ou aurait envoyé)
  response            JSONB,                -- réponse brute AE
  status              TEXT NOT NULL,        -- 'dry_run' | 'sent' | 'error'
  error_message       TEXT,
  dry_run             BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_forwards_medusa_order ON dropship_order_forwards(medusa_order_id);
CREATE INDEX IF NOT EXISTS idx_order_forwards_status ON dropship_order_forwards(status);

-- Idempotence : pour les vraies commandes (dry_run=false) on ne doit pas
-- envoyer deux fois la même au fournisseur.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_forwards_live_unique
  ON dropship_order_forwards(medusa_order_id)
  WHERE dry_run = false AND status = 'sent';
