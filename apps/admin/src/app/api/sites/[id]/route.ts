import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }
  return NextResponse.json({ site: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const supabase = createClient();

  // Delete related campaigns first
  await supabase.from('campaigns').delete().eq('site_id', id);

  // Delete related catalogs
  await supabase.from('catalogs').delete().eq('site_id', id);

  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`[api/sites/${id}] Delete failed:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
