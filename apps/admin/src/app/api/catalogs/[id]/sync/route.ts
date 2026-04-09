import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CJDropshippingClient, getAliExpressClient } from '@dropship/suppliers';
import type { SupplierProduct } from '@dropship/suppliers';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = createClient();

  const { data: catalog, error: fetchErr } = await supabase
    .from('catalogs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !catalog) {
    return NextResponse.json(
      { error: fetchErr?.message ?? 'Catalog not found' },
      { status: 404 },
    );
  }

  const startTime = Date.now();
  let productsFound = 0;
  let productsAdded = 0;

  try {
    const keywords: string[] = catalog.keywords ?? [];
    const supplier = catalog.supplier as string;

    let products: SupplierProduct[] = [];
    let supplierName = supplier;

    if (supplier === 'cj' || supplier === 'cjdropshipping') {
      const apiKey = process.env.CJ_DROPSHIPPING_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'CJ_DROPSHIPPING_API_KEY not configured' }, { status: 500 });
      }
      const client = new CJDropshippingClient({ apiKey });
      products = await client.searchProducts(keywords, { limit: 50 });
      supplierName = 'cjdropshipping';
    } else if (supplier === 'aliexpress') {
      const client = getAliExpressClient();
      if (!client) {
        return NextResponse.json({ error: 'AliExpress API keys not configured (ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET)' }, { status: 500 });
      }
      products = await client.searchProducts(keywords, { limit: 50 });
      supplierName = 'aliexpress';
    } else {
      return NextResponse.json({ error: `Unsupported supplier: ${supplier}` }, { status: 400 });
    }

    productsFound = products.length;

    for (const product of products) {
      const margin = catalog.margin ?? 100;
      const priceCents = Math.round(product.costCents * (1 + margin / 100));

      const { error: upsertErr } = await supabase.from('products').upsert({
        catalog_id: id,
        site_id: catalog.site_id,
        external_id: product.externalId,
        supplier: supplierName,
        name: product.name,
        description: product.description,
        category: product.category,
        cost_cents: product.costCents,
        price_cents: priceCents,
        image_urls: product.imageUrls,
        variants: product.variants,
        shipping_days_min: product.shippingDays.min,
        shipping_days_max: product.shippingDays.max,
        in_stock: true,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'catalog_id,external_id' });

      if (upsertErr) {
        console.error('[catalog-sync] Upsert failed:', product.name, upsertErr.message);
        continue;
      }
      productsAdded++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[catalog-sync] Sync error:', msg);
    await supabase.from('sync_logs').insert({
      catalog_id: id,
      site_id: catalog.site_id,
      status: 'error',
      error: msg,
      products_found: 0,
      products_added: 0,
      duration_ms: Date.now() - startTime,
    });
    return NextResponse.json({ error: `Sync failed: ${msg}` }, { status: 500 });
  }

  const now = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const { error: updateErr } = await supabase
    .from('catalogs')
    .update({ last_sync_at: now, product_count: productsAdded })
    .eq('id', id);

  if (updateErr) {
    console.error('[catalog-sync] Catalog update error:', updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from('sync_logs').insert({
    catalog_id: id,
    site_id: catalog.site_id,
    status: 'success',
    products_found: productsFound,
    products_added: productsAdded,
    duration_ms: durationMs,
  });

  return NextResponse.json({
    success: true,
    catalog_id: id,
    products_found: productsFound,
    products_added: productsAdded,
    last_sync_at: now,
    duration_ms: durationMs,
  });
}
