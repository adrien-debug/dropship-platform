/** Ligne `dropship_products` (Postgres Railway) — partagé UI / API sans importer `pg`. */
export interface Product {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  cost_cents: number | null;
  category: string | null;
  supplier: string | null;
  external_id: string | null;
  image_url: string | null;
  status: string;
  medusa_product_id: string | null;
  published_to_medusa_at: string | null;
  created_at: string;
  updated_at: string;
}
