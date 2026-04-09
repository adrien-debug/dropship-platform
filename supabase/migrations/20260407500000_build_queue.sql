CREATE TABLE IF NOT EXISTS build_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  niche text NOT NULL DEFAULT '',
  market text NOT NULL DEFAULT 'FR',
  positioning text NOT NULL DEFAULT 'Milieu de gamme',
  design_system text NOT NULL DEFAULT 'swiss',
  status text NOT NULL DEFAULT 'queued',
  port int,
  error text,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_build_queue_status ON build_queue(status);

ALTER TABLE build_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'build_queue' AND policyname = 'build_queue_all'
  ) THEN
    CREATE POLICY build_queue_all ON build_queue FOR ALL USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
