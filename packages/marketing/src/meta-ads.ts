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

  async getCampaignInsights(campaignId: string, dateRange?: { since: string; until: string }) {
    const params = new URLSearchParams({
      fields: 'impressions,clicks,spend,cpc,ctr,reach',
    });
    if (dateRange) {
      params.set('time_range', JSON.stringify(dateRange));
    }
    return this.request('GET', `/${campaignId}/insights?${params}`);
  }
}
