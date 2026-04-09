import type { CampaignStats } from './google-ads.js';

export type { CampaignStats };

const EMPTY_STATS: CampaignStats = {
  impressions: 0,
  clicks: 0,
  conversions: 0,
  spend_cents: 0,
  ctr: 0,
  roas: 0,
};

export class MetaAdsClient {
  private accessToken: string;
  private appId: string;
  private baseUrl = 'https://graph.facebook.com/v19.0';

  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN ?? '';
    this.appId = process.env.META_APP_ID ?? '';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
    return res.json() as T;
  }

  async createCampaign(adAccountId: string, opts: {
    name: string;
    objective: string;
    dailyBudget: number;
    status?: string;
  }) {
    return this.request('POST', `/act_${adAccountId}/campaigns`, {
      name: opts.name,
      objective: opts.objective,
      daily_budget: opts.dailyBudget,
      status: opts.status || 'PAUSED',
      special_ad_categories: [],
    });
  }

  async getCampaignInsights(campaignId: string, dateRange?: { since: string; until: string }): Promise<CampaignStats> {
    if (!this.accessToken) return EMPTY_STATS;
    try {
      const params = new URLSearchParams({
        fields: 'impressions,clicks,spend,actions,purchase_roas',
      });
      if (dateRange) {
        params.set('time_range', JSON.stringify(dateRange));
      }
      const raw = await this.request<{
        data?: Array<{
          impressions?: string;
          clicks?: string;
          spend?: string;
          actions?: Array<{ action_type: string; value: string }>;
          purchase_roas?: Array<{ action_type: string; value: string }>;
        }>;
      }>('GET', `/${campaignId}/insights?${params}`);

      const row = raw.data?.[0];
      if (!row) return EMPTY_STATS;
      const impressions = Number(row.impressions ?? 0);
      const clicks = Number(row.clicks ?? 0);
      const spend_cents = Math.round(Number(row.spend ?? 0) * 100);
      const conversions = Number(
        row.actions?.find(a => a.action_type === 'purchase')?.value ?? 0,
      );
      const roas = Number(
        row.purchase_roas?.find(r => r.action_type === 'omni_purchase')?.value ?? 0,
      );
      return {
        impressions,
        clicks,
        conversions: Math.round(conversions),
        spend_cents,
        ctr: impressions > 0 ? clicks / impressions : 0,
        roas,
      };
    } catch {
      return EMPTY_STATS;
    }
  }
}
