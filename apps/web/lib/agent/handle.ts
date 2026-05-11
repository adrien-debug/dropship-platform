/**
 * Storefront / Medusa product handle assembly.
 *
 * Pattern: `{slug(title)}-{externalId8}-{storeId6}`
 *   - slug(title): lowercase, accents stripped, non-alphanumerics → '-'
 *   - externalId8: first 8 chars of the supplier external id, alphanum only
 *   - storeId6: first 6 hex chars of the store UUID (dashes stripped)
 *
 * The storeId suffix guarantees the same supplier product imported into
 * two stores does not collide on the Medusa side (handles are unique per
 * store but the Medusa key is global).
 *
 * Both the import path (lib/agent/store-creator) and the Google Merchant
 * feed (app/feeds/google-merchant/[slug].xml/route.ts) call this so they
 * never drift apart. If the convention has to change, this is the single
 * source of truth.
 */
export function slugifyTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function buildMedusaHandle(args: {
  title: string;
  externalId: string;
  storeId: string;
}): string {
  const titleSlug = slugifyTitle(args.title);
  const externalId8 = args.externalId.slice(0, 8).replace(/[^a-z0-9]/gi, '');
  const storeId6 = args.storeId.replace(/-/g, '').slice(0, 6);
  return `${titleSlug}-${externalId8}-${storeId6}`;
}
