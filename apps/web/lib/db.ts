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

  // Railway Postgres n'expose pas de TLS sur le proxy TCP public.
  // On désactive SSL pour les deux cas (interne + proxy public).
  pool = new Pool({
    connectionString,
    ssl: false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}
