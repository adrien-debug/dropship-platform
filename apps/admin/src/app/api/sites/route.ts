import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createSiteSchema } from '@dropship/core';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('sites').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sites: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSiteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('sites')
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data }, { status: 201 });
}
