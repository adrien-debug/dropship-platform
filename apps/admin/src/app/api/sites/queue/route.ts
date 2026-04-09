import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export interface QueueItem {
  id: string;
  name: string;
  slug: string;
  niche: string;
  market: string;
  positioning: string;
  design_system: string;
  status: 'queued' | 'building' | 'deploying' | 'live' | 'error';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  port?: number;
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('build_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table not yet migrated — return empty state
      if (error.code === 'PGRST205' || error.message.includes('build_queue')) {
        console.warn('[build-queue] Table not found — run migration 20260407500000_build_queue.sql');
        return NextResponse.json({ queue: [], active: 0, queued: 0, _migrationPending: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const active = (data ?? []).filter((q: QueueItem) => q.status === 'building' || q.status === 'deploying').length;
    const queued = (data ?? []).filter((q: QueueItem) => q.status === 'queued').length;

    return NextResponse.json({ queue: data ?? [], active, queued });
  } catch (err) {
    console.error('[build-queue] GET error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ queue: [], active: 0, queued: 0 }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const items = (await req.json()) as Array<{
      name: string;
      niche: string;
      market?: string;
      positioning?: string;
      design_system?: string;
    }>;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const supabase = createClient();

    const toInsert = items.map(item => ({
      name: item.name,
      slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      niche: item.niche,
      market: item.market || 'FR',
      positioning: item.positioning || 'Milieu de gamme',
      design_system: item.design_system || 'swiss',
      status: 'queued' as const,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('build_queue')
      .insert(toInsert)
      .select('*');

    if (error) {
      console.error('[build-queue] Insert error:', error.message);
      if (error.code === 'PGRST205' || error.message.includes('build_queue')) {
        return NextResponse.json({ error: 'Migration pending: run 20260407500000_build_queue.sql in Supabase SQL editor' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, queued: data?.length ?? 0, items: data });
  } catch (err) {
    console.error('[build-queue] POST error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Queue insert failed' }, { status: 500 });
  }
}
