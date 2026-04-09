import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { site_id, new_name } = (await req.json()) as { site_id: string; new_name?: string };

    if (!site_id) {
      return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: original, error: fetchErr } = await supabase
      .from('sites')
      .select('*')
      .eq('id', site_id)
      .single();

    if (fetchErr || !original) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const name = new_name || `${original.name} (copy)`;
    const slug = `${original.slug}-copy-${Date.now().toString(36)}`;

    const { data: newSite, error: insertErr } = await supabase
      .from('sites')
      .insert({
        name,
        slug,
        status: 'draft',
        theme: original.theme,
        config: {
          ...(typeof original.config === 'object' ? original.config : {}),
          cloned_from: site_id,
          port: undefined,
        },
        medusa_sales_channel_id: null,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('[sites/clone] Insert error:', insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Clone catalogs
    const { data: catalogs } = await supabase
      .from('catalogs')
      .select('*')
      .eq('site_id', site_id);

    if (catalogs && catalogs.length > 0) {
      for (const cat of catalogs) {
        const { id: _id, site_id: _sid, created_at: _ca, ...rest } = cat;
        await supabase.from('catalogs').insert({
          ...rest,
          site_id: newSite.id,
          name: `${rest.name ?? 'Catalog'} (clone)`,
        });
      }
    }

    // Clone products
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('site_id', site_id);

    if (products && products.length > 0) {
      const toInsert = products.map(p => {
        const { id: _id, site_id: _sid, created_at: _ca, ...rest } = p;
        return { ...rest, site_id: newSite.id };
      });
      await supabase.from('products').insert(toInsert);
    }

    return NextResponse.json({ ok: true, site: newSite });
  } catch (err) {
    console.error('[sites/clone] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Clone failed' }, { status: 500 });
  }
}
