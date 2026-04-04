import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createCatalogSchema } from '@dropship/core';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('catalogs').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ catalogs: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createCatalogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.from('catalogs').insert({
    site_id: parsed.data.siteId,
    name: parsed.data.name,
    supplier: parsed.data.supplier,
    keywords: parsed.data.keywords,
    margin: parsed.data.margin,
    min_price: parsed.data.minPrice,
    max_price: parsed.data.maxPrice,
    auto_sync: parsed.data.autoSync,
    sync_cron: parsed.data.syncCron,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ catalog: data }, { status: 201 });
}
