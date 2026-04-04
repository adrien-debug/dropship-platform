import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createCampaignSchema } from '@dropship/core';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.from('campaigns').insert({
    site_id: parsed.data.siteId,
    platform: parsed.data.platform,
    name: parsed.data.name,
    daily_budget: parsed.data.dailyBudget,
    targeting: parsed.data.targeting,
    creatives: parsed.data.creatives,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
