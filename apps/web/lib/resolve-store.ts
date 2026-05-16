import { getDbRead } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Accepts either a store UUID or a slug and returns the UUID.
 * Returns null if no matching store exists.
 * Use this when a route param ([id]) might receive either form.
 */
export async function resolveStoreId(idOrSlug: string): Promise<string | null> {
  if (!idOrSlug) return null;
  const db = getDbRead();
  const sql = isUuid(idOrSlug)
    ? `SELECT id FROM dropship_stores WHERE id = $1 LIMIT 1`
    : `SELECT id FROM dropship_stores WHERE slug = $1 LIMIT 1`;
  const { rows } = await db.query<{ id: string }>(sql, [idOrSlug]);
  return rows[0]?.id ?? null;
}
