import type { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { listProducts } from '@/lib/medusa-store';
import { siteBaseUrl, storeUrl, productUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // refresh every hour

interface ActiveStoreRow {
  slug: string;
  name: string;
  medusa_publishable_key: string;
  updated_at: Date;
}

/**
 * Dynamic sitemap. Lists:
 *   - root and the legal pages (static)
 *   - one entry per active store landing page
 *   - one entry per product across active stores
 *
 * Best-effort: a Medusa hiccup or a store with an invalid publishable key
 * does not block the rest of the sitemap. The catalog fetch is parallelized
 * across stores.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/legal/cgv`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  let stores: ActiveStoreRow[] = [];
  try {
    const db = getDb();
    const { rows } = await db.query<ActiveStoreRow>(
      `SELECT slug, name, medusa_publishable_key, updated_at
         FROM dropship_stores
        WHERE status = 'active'
        ORDER BY updated_at DESC
        LIMIT 500`,
    );
    stores = rows;
  } catch {
    return staticEntries;
  }

  const storeEntries: MetadataRoute.Sitemap = stores.map((s) => ({
    url: storeUrl(s.slug),
    lastModified: s.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const productEntries = (
    await Promise.all(
      stores.map(async (s) => {
        try {
          const { products } = await listProducts({ limit: 50, publishableKey: s.medusa_publishable_key });
          return products.map((p) => ({
            url: productUrl(s.slug, p.handle),
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          }));
        } catch {
          return [];
        }
      }),
    )
  ).flat();

  return [...staticEntries, ...storeEntries, ...productEntries];
}
