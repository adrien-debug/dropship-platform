import { NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import { siteBaseUrl, storeUrl } from '@/lib/seo';
import { buildMedusaHandle } from '@/lib/agent/handle';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 min — Merchant Center polls every few hours anyway

/**
 * Google Merchant Center XML feed (RSS 2.0 + g: namespace).
 * Source: https://support.google.com/merchants/answer/7052112
 *
 * Per-store URL: /feeds/google-merchant/{slug}.xml — one feed per store
 * so Hearst can run distinct campaigns per brand inside the same Merchant
 * Center account.
 *
 * Fields emitted are the Shopping required set + the high-impact optional
 * ones (brand, condition, identifier_exists, age_group, gender, GTIN
 * skipped because no supplier provides it — we mark identifier_exists
 * false). Availability is hardcoded to in_stock for now — dropship has
 * no real inventory signal, the supplier handles it on the AE side.
 *
 * Pricing is taken from dropship_store_products.price_cents which is
 * already the retail price the storefront displays.
 */

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  niche: string;
  logo_emoji: string;
}

interface ProductRow {
  medusa_product_id: string;
  external_id: string;
  enriched_title: string;
  enriched_description: string;
  price_cents: number;
  image_url: string | null;
  supplier: string;
}

const CURRENCY = 'EUR';

function escapeXml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)} ${CURRENCY}`;
}


export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDbRead();

  const { rows: stores } = await db.query<StoreRow>(
    `SELECT id, slug, name, tagline, description, niche, logo_emoji
       FROM dropship_stores
      WHERE slug = $1 AND status = 'active'
      LIMIT 1`,
    [slug],
  );
  const store = stores[0];
  if (!store) {
    return new NextResponse('store not found', { status: 404 });
  }

  const { rows: products } = await db.query<ProductRow>(
    `SELECT medusa_product_id, external_id, enriched_title, enriched_description,
            price_cents, image_url, supplier
       FROM dropship_store_products
      WHERE store_id = $1
        AND medusa_product_id IS NOT NULL
        AND image_url IS NOT NULL
        AND price_cents > 0
      ORDER BY created_at ASC`,
    [store.id],
  );

  // Storefront handle reconstructed from the same convention used at import
  // time (lib/agent/handle.ts). No DB round-trip to Medusa needed.
  const base = siteBaseUrl();
  const items = products.map((p) => {
    const id = p.external_id;
    const handle = buildMedusaHandle({
      title: p.enriched_title,
      externalId: p.external_id,
      storeId: store.id,
    });
    const link = `${base}/shop/${slug}/products/${encodeURIComponent(handle)}`;
    return `
    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${escapeXml(p.enriched_title.slice(0, 150))}</g:title>
      <g:description>${escapeXml(p.enriched_description.slice(0, 5000))}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(p.image_url ?? '')}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${fmtPrice(p.price_cents)}</g:price>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:brand>${escapeXml(store.name)}</g:brand>
      <g:product_type>${escapeXml(store.niche)}</g:product_type>
      <g:google_product_category></g:google_product_category>
      <g:shipping>
        <g:country>FR</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 EUR</g:price>
      </g:shipping>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(store.name)}</title>
    <link>${escapeXml(storeUrl(slug))}</link>
    <description>${escapeXml(store.tagline || store.description || `${store.name} — ${store.niche}`)}</description>${items.join('')}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
