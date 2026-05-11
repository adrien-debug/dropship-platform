import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateAdVariants } from '@/lib/agent/ad-variants';

const Body = z.object({
  language: z.enum(['fr', 'en']).optional(),
});

interface StoreRow {
  id: string;
  name: string;
  niche: string;
}

interface ProductRow {
  id: string;
  enriched_title: string;
  enriched_description: string;
}

/**
 * Fan-out ad copy variants for one product of one store. Calls Claude
 * Haiku once, persists 3 channel-tagged variants (Meta / TikTok /
 * Google) in dropship_ad_variants, returns the batch.
 *
 * Rate limited 10/min/IP — the call is cheap (~0.0014 € / product) but
 * we don't want a runaway loop on the admin form.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  const limited = await enforceRateLimit(request, 'ad-variants', { max: 10, windowSec: 60 });
  if (limited) return limited;

  const { id: storeId, pid: productId } = await params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const db = getDb();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, name, niche FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const store = storeRes.rows[0];
  if (!store) {
    return NextResponse.json({ ok: false, error: 'store_not_found' }, { status: 404 });
  }

  const productRes = await db.query<ProductRow>(
    `SELECT id, enriched_title, enriched_description
       FROM dropship_store_products
      WHERE id = $1 AND store_id = $2
      LIMIT 1`,
    [productId, storeId],
  );
  const product = productRes.rows[0];
  if (!product) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
  }

  try {
    const variants = await generateAdVariants({
      storeId: store.id,
      storeName: store.name,
      productId: product.id,
      productTitle: product.enriched_title,
      productDescription: product.enriched_description,
      niche: store.niche,
      language: body.language ?? 'fr',
    });
    return NextResponse.json({ ok: true, variants });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
