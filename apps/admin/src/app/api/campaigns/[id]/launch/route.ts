import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GoogleAdsClient } from '@dropship/marketing';
import { MetaAdsClient } from '@dropship/marketing';

export async function POST(
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
  let externalId: string | undefined;
  let success = false;
  let errorCode: string | undefined;

  try {
    if (platform === 'google') {
      const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
      const merchantId = process.env.GOOGLE_ADS_MERCHANT_ID;
      if (!devToken || !clientId || !customerId || !merchantId) {
        errorCode = 'credentials_missing';
      } else {
        const client = new GoogleAdsClient();
        const res = (await client.createShoppingCampaign(customerId, {
          name: campaign.name,
          dailyBudgetMicros: Math.round((campaign.daily_budget ?? 10) * 1_000_000),
          merchantId,
        })) as { results?: Array<{ resourceName?: string }> };
        externalId = res.results?.[0]?.resourceName;
        success = true;
      }
    } else if (platform === 'meta') {
      const token = process.env.META_ACCESS_TOKEN;
      const adAccountId = process.env.META_AD_ACCOUNT_ID;
      if (!token || !adAccountId) {
        errorCode = 'credentials_missing';
      } else {
        const client = new MetaAdsClient();
        const res = (await client.createCampaign(adAccountId, {
          name: campaign.name,
          objective: 'CONVERSIONS',
          dailyBudget: Math.round((campaign.daily_budget ?? 10) * 100),
        })) as { id?: string };
        externalId = res.id;
        success = true;
      }
    } else {
      errorCode = 'unsupported_platform';
    }
  } catch (err) {
    console.error('[launch] API error:', err instanceof Error ? err.message : err);
    errorCode = 'api_error';
  }

  const newStatus = success ? 'launched' : 'launch_failed';
  await supabase
    .from('campaigns')
    .update({ status: newStatus, ...(externalId ? { external_id: externalId } : {}) })
    .eq('id', id);

  return NextResponse.json({ success, platform, externalId, error: errorCode });
}
