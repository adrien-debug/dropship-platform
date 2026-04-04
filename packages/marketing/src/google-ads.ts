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
