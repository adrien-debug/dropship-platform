import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3200';

export async function POST() {
  try {
    const supabase = createClient();

    // Check active builds
    const { count: activeCount } = await supabase
      .from('build_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['building', 'deploying']);

    const MAX_CONCURRENT = 3;
    if ((activeCount ?? 0) >= MAX_CONCURRENT) {
      return NextResponse.json({ message: 'Max concurrent builds reached', active: activeCount });
    }

    const slotsAvailable = MAX_CONCURRENT - (activeCount ?? 0);

    // Get next queued items
    const { data: queued, error } = await supabase
      .from('build_queue')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(slotsAvailable);

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('build_queue')) {
        console.warn('[build-queue] Table not found — migration pending');
        return NextResponse.json({ message: 'Migration pending', active: 0 });
      }
    }
    if (!queued || queued.length === 0) {
      return NextResponse.json({ message: 'No queued items', active: activeCount });
    }

    const launched: string[] = [];

    for (const item of queued) {
      // Mark as building
      await supabase
        .from('build_queue')
        .update({ status: 'building', started_at: new Date().toISOString() })
        .eq('id', item.id);

      // Assign port (3100 + offset based on queue position)
      const { count: totalSites } = await supabase
        .from('sites')
        .select('*', { count: 'exact', head: true });
      const port = 3100 + ((totalSites ?? 0) + launched.length + 1);

      // Trigger shops/setup then launcher/stream via fetch (non-blocking)
      triggerBuild(item, port, supabase).catch(err => {
        console.error(`[build-queue] Build failed for ${item.name}:`, err instanceof Error ? err.message : err);
        supabase
          .from('build_queue')
          .update({ status: 'error', error: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
          .eq('id', item.id)
          .then(() => {});
      });

      launched.push(item.id);
    }

    return NextResponse.json({ message: `Launched ${launched.length} builds`, launched });
  } catch (err) {
    console.error('[build-queue] Process error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Queue processing failed' }, { status: 500 });
  }
}

async function triggerBuild(
  item: { id: string; name: string; slug: string; niche: string; market: string; positioning: string; design_system: string },
  port: number,
  supabase: ReturnType<typeof createClient>,
) {
  // Step 1: Setup shop (Medusa + CJ products + Supabase site)
  const setupRes = await fetch(`${ADMIN_URL}/api/shops/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: item.name,
      slug: item.slug,
      port,
      niche: item.niche,
      market: item.market,
      positioning: item.positioning,
      designSystem: item.design_system,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!setupRes.ok) {
    const err = await setupRes.text().catch(() => '');
    throw new Error(`Setup failed: ${err.slice(0, 300)}`);
  }

  const setupData = (await setupRes.json()) as {
    siteId?: string;
    salesChannelId?: string;
    publishableKey?: string;
    regionId?: string;
    importedProducts?: unknown[];
  };

  // Update queue with site_id
  await supabase
    .from('build_queue')
    .update({ site_id: setupData.siteId, port, status: 'deploying' })
    .eq('id', item.id);

  // Step 2: Trigger launcher stream (build + deploy)
  const outputDir = `~/generated-sites/${item.slug}`;
  const streamRes = await fetch(`${ADMIN_URL}/api/launcher/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        projectName: item.name,
        niche: item.niche,
        outputDir,
        port,
        market: item.market,
        positioning: item.positioning,
        designSystem: item.design_system,
        siteId: setupData.siteId,
        salesChannelId: setupData.salesChannelId,
        publishableKey: setupData.publishableKey,
        regionId: setupData.regionId,
        importedProducts: setupData.importedProducts,
      },
    }),
    signal: AbortSignal.timeout(600_000),
  });

  // Read the SSE stream to completion
  if (streamRes.body) {
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let lastEvent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastEvent = decoder.decode(value, { stream: true });
    }

    const isError = lastEvent.includes('"error"');
    await supabase
      .from('build_queue')
      .update({
        status: isError ? 'error' : 'live',
        completed_at: new Date().toISOString(),
        ...(isError ? { error: 'Build/deploy failed' } : {}),
      })
      .eq('id', item.id);
  }
}
