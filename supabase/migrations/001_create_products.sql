-- Migration: create products table
-- Exécuter dans le SQL Editor du dashboard Supabase (projet lvhhytvwabrqwmizyfly)

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
