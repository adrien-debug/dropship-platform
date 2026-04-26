import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Retourne un pool Postgres Railway (lazy — safe pour `next build`).
 * Variable attendue : DATABASE_URL (postgresql://user:pass@host:port/db)
 */
export function getDb(): Pool {
  if (pool) return pool;

  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL manquant : défini sur Vercel / Railway dans les variables d\'environnement.',
    );
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('railway.internal')
      ? false
      : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

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
