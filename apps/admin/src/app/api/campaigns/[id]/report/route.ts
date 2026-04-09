import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleAdsClient, MetaAdsClient } from '@dropship/marketing';
import type { CampaignStats } from '@dropship/marketing';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const supabase = createClient();

  const { data: campaign, error: fetchErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !campaign) {
    return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  }

  const platform: string = campaign.platform;
  const externalId: string | undefined = campaign.external_id;

  let stats: CampaignStats = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend_cents: 0,
    ctr: 0,
    roas: 0,
  };

  if (externalId) {
    if (platform === 'google') {
      const client = new GoogleAdsClient();
      stats = await client.getCampaignStats(externalId);
    } else if (platform === 'meta') {
      const client = new MetaAdsClient();
      stats = await client.getCampaignInsights(externalId);
    }
  }

  const { error: insertErr } = await supabase.from('campaign_reports').insert({
    campaign_id: id,
    platform,
    impressions: stats.impressions,
    clicks: stats.clicks,
    conversions: stats.conversions,
    spend_cents: stats.spend_cents,
    ctr: stats.ctr,
    roas: stats.roas,
    raw_response: stats,
  });

  if (insertErr) {
    console.error('[report] insert error:', insertErr.message);
  }

  return NextResponse.json({ campaign, stats });
}
