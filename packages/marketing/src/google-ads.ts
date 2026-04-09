export interface CampaignStats {
  impressions: number;
  clicks: number;
  conversions: number;
  spend_cents: number;
  ctr: number;
  roas: number;
}

const EMPTY_STATS: CampaignStats = {
  impressions: 0,
  clicks: 0,
  conversions: 0,
  spend_cents: 0,
  ctr: 0,
  roas: 0,
};

export class GoogleAdsClient {
  private developerToken: string;
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '';
    this.clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? '';
    this.clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? '';
    this.refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    if (!this.developerToken || !this.clientId || !this.clientSecret || !this.refreshToken) {
      return EMPTY_STATS;
    }
    try {
      const token = await this.getAccessToken();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID ?? '';
      if (!customerId) return EMPTY_STATS;
      const query = `
        SELECT
          campaign.id,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.all_conversions_value
        FROM campaign
        WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_30_DAYS
      `.trim();
      const res = await fetch(
        `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'developer-token': this.developerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        },
      );
      if (!res.ok) return EMPTY_STATS;
      const json = (await res.json()) as {
        results?: Array<{
          metrics: {
            impressions: string;
            clicks: string;
            conversions: string;
            costMicros: string;
            allConversionsValue: string;
          };
        }>;
      };
      const row = json.results?.[0]?.metrics;
      if (!row) return EMPTY_STATS;
      const impressions = Number(row.impressions);
      const clicks = Number(row.clicks);
      const spend_cents = Math.round(Number(row.costMicros) / 10_000);
      const conversions = Math.round(Number(row.conversions));
      const revenue_cents = Math.round(Number(row.allConversionsValue) * 100);
      return {
        impressions,
        clicks,
        conversions,
        spend_cents,
        ctr: impressions > 0 ? clicks / impressions : 0,
        roas: spend_cents > 0 ? revenue_cents / spend_cents : 0,
      };
    } catch {
      return EMPTY_STATS;
    }
  }

  async createShoppingCampaign(customerId: string, opts: {
    name: string;
    dailyBudgetMicros: number;
    merchantId: string;
    countryCode?: string;
  }) {
    const token = await this.getAccessToken();
    const mutateUrl = `https://googleads.googleapis.com/v16/customers/${customerId}/campaigns:mutate`;
    const res = await fetch(mutateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{
          create: {
            name: opts.name,
            advertisingChannelType: 'SHOPPING',
            status: 'PAUSED',
            campaignBudget: opts.dailyBudgetMicros,
            shoppingSetting: {
              merchantId: opts.merchantId,
              salesCountry: opts.countryCode || 'FR',
            },
          },
        }],
      }),
    });
    if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`);
    return res.json();
  }
}
