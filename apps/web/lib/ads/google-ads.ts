import { getDb } from '@/lib/db';

/**
 * Google Ads campaign push helper.
 *
 * Mirrors the contract of meta-ads.ts and tiktok-ads.ts so the ads
 * copilot can call the three channels with the same shape.
 *
 * Scope: create a CampaignBudget + Campaign + AdGroup + Responsive
 * Search Ad in a single shot, mark the campaign PAUSED so the operator
 * activates it manually in Google Ads UI after a final visual check. We
 * never auto-spend on first push.
 *
 * Auth: same OAuth2 refresh-token flow as `lib/analytics/google-ads.ts`.
 * The two modules keep separate caches because they ship as a unit and
 * sharing a cache module would couple analytics to the ads layer.
 *
 * Fail-soft contract: missing env vars or non-200 responses produce a
 * `dropship_ad_campaigns` row with `status='draft'` + `error_message`,
 * never throws.
 */

const API_VERSION = 'v18';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 20_000;

export interface GoogleAdsPushArgs {
  storeId: string;
  storeSlug: string;
  variantId: string;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string | null;
  imageUrl: string | null;
  productUrl: string;
  dailyBudgetEur: number;
  days: number;
}

export interface GoogleAdsPushResult {
  status: 'live' | 'paused' | 'draft' | 'error';
  externalId: string | null;
  error?: string;
  campaignDbId: string;
}

export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN &&
      process.env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let _cachedToken: CachedToken | null = null;

async function getAccessToken(signal: AbortSignal): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 30_000) return _cachedToken.accessToken;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`google-ads token exchange ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = { accessToken: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

/** Strip non-digits from the customer ID. Google Ads accepts "123-456-7890" or "1234567890". */
function customerIdOnly(): string {
  return (process.env.GOOGLE_ADS_CUSTOMER_ID ?? '').replace(/\D/g, '');
}

function loginCustomerId(): string | null {
  const id = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').replace(/\D/g, '');
  return id || null;
}

/** Google Ads expresses budgets in "micros" — 1 EUR = 1_000_000. */
function eurToMicros(eur: number): number {
  return Math.round(eur * 1_000_000);
}

/**
 * Truncate to a max length, breaking on word boundary when possible.
 * Google Search ad assets have very tight limits:
 *   - headlines: 30 chars
 *   - descriptions: 90 chars
 */
function clip(s: string, max: number): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > max * 0.5 ? cut.slice(0, lastSpace).trim() : cut.trim();
}

/**
 * Run a Google Ads v18 mutate request. Returns the raw `results` array
 * or throws with the API error message.
 */
async function mutate(
  customerId: string,
  resource: 'campaignBudgets' | 'campaigns' | 'adGroups' | 'adGroupAds',
  operations: unknown[],
  accessToken: string,
  signal: AbortSignal,
): Promise<Array<{ resourceName: string }>> {
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/${resource}:mutate`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
  };
  const mcc = loginCustomerId();
  if (mcc) headers['login-customer-id'] = mcc;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operations }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.slice(0, 400);
    throw new Error(`google-ads ${resource}:mutate ${res.status} — ${snippet}`);
  }
  const json = JSON.parse(text) as { results: Array<{ resourceName: string }> };
  return json.results ?? [];
}

export function googleCampaignName(storeSlug: string, variantId: string): string {
  return `${storeSlug}-${variantId.slice(0, 8)}`;
}

/**
 * Push a Search campaign (Budget + Campaign + AdGroup + RSA) for a
 * single variant. The campaign is created PAUSED so the operator
 * activates it in Google Ads UI after a final visual review — first
 * push must never auto-spend.
 */
export async function pushGoogleAdsCampaign(args: GoogleAdsPushArgs): Promise<GoogleAdsPushResult> {
  const db = getDb();
  const insertCampaign = async (
    status: GoogleAdsPushResult['status'],
    externalId: string | null,
    error: string | null,
    payload: unknown,
  ) => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, external_id, status,
          daily_budget_eur, push_payload, error_message, pushed_at)
       VALUES ($1, $2, 'google', $3, $4, $5, $6, $7,
               CASE WHEN $3 IS NOT NULL THEN now() ELSE NULL END)
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        externalId,
        status,
        args.dailyBudgetEur,
        JSON.stringify({ ...(payload as object), days: args.days }),
        error,
      ],
    );
    return rows[0]!.id;
  };

  if (!isGoogleAdsConfigured()) {
    const id = await insertCampaign(
      'draft',
      null,
      'GOOGLE_ADS_* env vars manquantes',
      { name: googleCampaignName(args.storeSlug, args.variantId) },
    );
    return { status: 'draft', externalId: null, error: 'Google Ads non configuré', campaignDbId: id };
  }

  const customerId = customerIdOnly();
  const name = googleCampaignName(args.storeSlug, args.variantId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const accessToken = await getAccessToken(controller.signal);

    // 1) Budget
    const budgetResults = await mutate(
      customerId,
      'campaignBudgets',
      [
        {
          create: {
            name: `${name}-budget`,
            amountMicros: String(eurToMicros(args.dailyBudgetEur)),
            deliveryMethod: 'STANDARD',
            explicitlyShared: false,
          },
        },
      ],
      accessToken,
      controller.signal,
    );
    const budgetResource = budgetResults[0]?.resourceName;
    if (!budgetResource) throw new Error('budget resourceName missing');

    // 2) Campaign — PAUSED on first push.
    const now = new Date();
    const end = new Date(now.getTime() + args.days * 86_400_000);
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

    const campaignResults = await mutate(
      customerId,
      'campaigns',
      [
        {
          create: {
            name,
            advertisingChannelType: 'SEARCH',
            status: 'PAUSED',
            manualCpc: { enhancedCpcEnabled: false },
            campaignBudget: budgetResource,
            startDate: fmt(now),
            endDate: fmt(end),
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
          },
        },
      ],
      accessToken,
      controller.signal,
    );
    const campaignResource = campaignResults[0]?.resourceName;
    if (!campaignResource) throw new Error('campaign resourceName missing');
    const externalId = campaignResource.split('/').pop() ?? null;

    // 3) Ad Group
    const adGroupResults = await mutate(
      customerId,
      'adGroups',
      [
        {
          create: {
            name: `${name}-adgroup`,
            campaign: campaignResource,
            status: 'ENABLED',
            type: 'SEARCH_STANDARD',
            cpcBidMicros: String(eurToMicros(0.4)),
          },
        },
      ],
      accessToken,
      controller.signal,
    );
    const adGroupResource = adGroupResults[0]?.resourceName;
    if (!adGroupResource) throw new Error('adGroup resourceName missing');

    // 4) Responsive Search Ad
    const baseHook = args.headline;
    const longHook = `${args.headline} — ${args.primaryText}`;
    const headlines = [
      { text: clip(baseHook, 30) },
      { text: clip(args.primaryText, 30) },
      { text: clip(args.description ?? args.cta ?? 'Découvrir', 30) },
    ];
    const descriptions = [
      { text: clip(args.primaryText, 90) },
      { text: clip(longHook, 90) },
    ];
    await mutate(
      customerId,
      'adGroupAds',
      [
        {
          create: {
            adGroup: adGroupResource,
            status: 'ENABLED',
            ad: {
              finalUrls: [args.productUrl],
              responsiveSearchAd: { headlines, descriptions },
            },
          },
        },
      ],
      accessToken,
      controller.signal,
    );

    const id = await insertCampaign('paused', externalId, null, {
      name,
      budget: budgetResource,
      campaign: campaignResource,
      adGroup: adGroupResource,
    });
    return {
      status: 'paused',
      externalId,
      campaignDbId: id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const id = await insertCampaign('error', null, message, { name });
    return { status: 'error', externalId: null, error: message, campaignDbId: id };
  } finally {
    clearTimeout(timeout);
  }
}
