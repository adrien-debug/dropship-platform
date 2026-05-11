import { Pool } from 'pg';

let pool: Pool | null = null;
let readPool: Pool | null = null;

function makePool(connectionString: string, maxConnections = 5): Pool {
  return new Pool({
    connectionString,
    // Railway Postgres doesn't expose TLS on the public TCP proxy.
    ssl: false,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

/**
 * Primary write pool — checkout, agent, mutations.
 * Variable: DATABASE_URL
 */
export function getDb(): Pool {
  if (pool) return pool;
  const cs = (process.env.DATABASE_URL || '').trim();
  if (!cs) throw new Error('DATABASE_URL manquant : défini sur Vercel / Railway dans les variables d\'environnement.');
  pool = makePool(cs);
  return pool;
}

/**
 * Read-only replica pool — dashboards, analytics pages, exports.
 * Uses DATABASE_URL_REPLICA when set; falls back to primary so this
 * works in dev without a replica configured.
 * Variable: DATABASE_URL_REPLICA (optional)
 */
export function getDbRead(): Pool {
  if (readPool) return readPool;
  const replica = (process.env.DATABASE_URL_REPLICA || '').trim();
  const cs = replica || (process.env.DATABASE_URL || '').trim();
  if (!cs) throw new Error('DATABASE_URL manquant : défini sur Vercel / Railway dans les variables d\'environnement.');
  readPool = makePool(cs, replica ? 10 : 5);
  return readPool;
}
