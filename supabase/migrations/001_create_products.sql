-- Migration: create products table
-- Appliquée sur :
--   • Supabase : projet lvhhytvwabrqwmizyfly (via supabase db push)
--   • Railway Postgres : dropship-medusa > Postgres (via TCP proxy hopper.proxy.rlwy.net:51210)
--     Table nommée dropship_products pour éviter collision avec le schema Medusa

-- ============================================================
-- Supabase (table: products)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  cost_cents integer,
  category text,
  supplier text,
  external_id text,
  image_url text,
  status text NOT NULL DEFAULT 'draft',
  medusa_product_id text,
  published_to_medusa_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.products IS 'Produits importés des fournisseurs, synchronisés vers Medusa';

CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_medusa_id ON public.products(medusa_product_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON public.products(supplier);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.products
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Railway Postgres (table: dropship_products)
-- DDL exécutable versionné : voir ../../infra/postgres/001_dropship_products.sql
-- ============================================================
-- CREATE TABLE IF NOT EXISTS public.dropship_products (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   title text NOT NULL,
--   description text,
--   price_cents integer NOT NULL DEFAULT 0,
--   cost_cents integer,
--   category text,
--   supplier text,
--   external_id text,
--   image_url text,
--   status text NOT NULL DEFAULT 'draft',
--   medusa_product_id text,
--   published_to_medusa_at timestamptz,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );
