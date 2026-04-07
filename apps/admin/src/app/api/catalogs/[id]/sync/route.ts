import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CJDropshippingClient } from '@dropship/suppliers';

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

  let productCount = 0;

  try {
    const keywords: string[] = catalog.keywords ?? [];

    if (catalog.supplier === 'cj') {
      const apiKey = process.env.CJ_DROPSHIPPING_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'CJ_DROPSHIPPING_API_KEY not configured' },
          { status: 500 },
        );
      }
      const client = new CJDropshippingClient({ apiKey });
      const products = await client.searchProducts(keywords, { limit: 50 });
      productCount = products.length;
    } else {
      return NextResponse.json(
        { error: `Unsupported supplier: ${catalog.supplier}` },
        { status: 400 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from('sync_logs').insert({
      catalog_id: id,
      site_id: catalog.site_id,
      status: 'error',
      error: msg,
      product_count: 0,
    });
    return NextResponse.json({ error: `Sync failed: ${msg}` }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('catalogs')
    .update({ last_synced: now, product_count: productCount })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from('sync_logs').insert({
    catalog_id: id,
    site_id: catalog.site_id,
    status: 'success',
    product_count: productCount,
  });

  return NextResponse.json({
    success: true,
    catalog_id: id,
    product_count: productCount,
    last_synced: now,
  });
}
