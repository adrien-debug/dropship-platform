import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = createClient();

  const [jobRes, eventsRes] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', id).single(),
    supabase
      .from('job_events')
      .select('*')
      .eq('job_id', id)
      .order('sequence', { ascending: true }),
  ]);

  if (jobRes.error) {
    console.error('[jobs/id] job fetch error:', jobRes.error.message);
    return NextResponse.json({ error: jobRes.error.message }, { status: jobRes.error.code === 'PGRST116' ? 404 : 500 });
  }

  if (eventsRes.error) {
    console.error('[jobs/id] events fetch error:', eventsRes.error.message);
    return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ job: jobRes.data, events: eventsRes.data });
}
