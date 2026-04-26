-- À exécuter sur la base pointée par DATABASE_URL (Railway / Postgres self-hosted).
-- Même schéma que l’app Next (`apps/web`) : import fournisseurs + publish Medusa.

CREATE TABLE IF NOT EXISTS public.dropship_products (
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

CREATE INDEX IF NOT EXISTS idx_dropship_products_status ON public.dropship_products(status);
CREATE INDEX IF NOT EXISTS idx_dropship_products_medusa_id ON public.dropship_products(medusa_product_id);
CREATE INDEX IF NOT EXISTS idx_dropship_products_supplier ON public.dropship_products(supplier);
