import { getDb } from '@/lib/db';

/**
 * TikTok Business API push helper.
 *
 * Same shape as the Meta module: build a campaign + adgroup + ad payload,
 * POST sequentially, log to `dropship_ad_campaigns`. Fail-soft when OAuth
 * is not configured — the founder still gets a row to come back to.
 */

const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3';

export interface TiktokPushArgs {
  storeId: string;
  storeSlug: string;
  variantId: string;
  headline: string;
  primaryText: string;
  description: string | null;
  cta: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  productUrl: string;
  dailyBudgetEur: number;
  days: number;
  targeting?: TiktokTargeting;
}

export interface TiktokTargeting {
  age_min?: number;
  age_max?: number;
  gender?: 'GENDER_MALE' | 'GENDER_FEMALE' | 'GENDER_UNLIMITED';
  location_ids?: string[];
  interest_keywords?: string[];
  placements?: string[];
}

export interface TiktokPushResult {
  status: 'live' | 'draft' | 'error';
  externalId: string | null;
  error?: string;
  campaignDbId: string;
}

export function isTiktokAdsConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_ADS_ACCESS_TOKEN &&
      process.env.TIKTOK_ADVERTISER_ID,
  );
}

export function tiktokCampaignName(storeSlug: string, variantId: string): string {
  return `dsv-${storeSlug}-${variantId}`;
}

export function buildTiktokPayload(args: TiktokPushArgs): {
  campaign: Record<string, unknown>;
  adgroup: Record<string, unknown>;
  ad: Record<string, unknown>;
} {
  const dailyBudget = Math.max(20, Math.round(args.dailyBudgetEur)); // TikTok takes EUR units, min 20.
  const name = tiktokCampaignName(args.storeSlug, args.variantId);
  const targeting = args.targeting ?? {};

  return {
    campaign: {
      advertiser_id: process.env.TIKTOK_ADVERTISER_ID ?? '__missing__',
      campaign_name: name,
      objective_type: 'CONVERSIONS',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: dailyBudget,
      operation_status: 'DISABLE',
    },
    adgroup: {
      advertiser_id: process.env.TIKTOK_ADVERTISER_ID ?? '__missing__',
      adgroup_name: `${name}-adgroup`,
      placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
      placements: targeting.placements ?? ['PLACEMENT_TIKTOK'],
      budget_mode: 'BUDGET_MODE_DAY',
      budget: dailyBudget,
      schedule_type: 'SCHEDULE_FROM_NOW',
      schedule_start_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      optimization_goal: 'CONVERT',
      billing_event: 'OCPM',
      bid_type: 'BID_TYPE_NO_BID',
      pacing: 'PACING_MODE_SMOOTH',
      age_groups: ageGroupsFor(targeting.age_min ?? 18, targeting.age_max ?? 55),
      gender: targeting.gender ?? 'GENDER_UNLIMITED',
      location_ids: targeting.location_ids ?? ['250'], // 250 = France
      interest_keyword_ids: undefined,
      operation_status: 'DISABLE',
    },
    ad: {
      advertiser_id: process.env.TIKTOK_ADVERTISER_ID ?? '__missing__',
      ad_name: `${name}-ad`,
      ad_format: args.videoUrl ? 'SINGLE_VIDEO' : 'SINGLE_IMAGE',
      ad_text: args.primaryText,
      call_to_action: mapTiktokCta(args.cta),
      landing_page_url: appendUtm(args.productUrl, args.storeSlug, args.variantId),
      image_ids: args.imageUrl ? [args.imageUrl] : undefined,
      video_id: args.videoUrl ?? undefined,
      operation_status: 'DISABLE',
    },
  };
}

function ageGroupsFor(min: number, max: number): string[] {
  // TikTok bucketises ages — map ranges to its canonical buckets.
  const buckets = [
    { id: 'AGE_13_17', min: 13, max: 17 },
    { id: 'AGE_18_24', min: 18, max: 24 },
    { id: 'AGE_25_34', min: 25, max: 34 },
    { id: 'AGE_35_44', min: 35, max: 44 },
    { id: 'AGE_45_54', min: 45, max: 54 },
    { id: 'AGE_55_100', min: 55, max: 100 },
  ];
  return buckets.filter((b) => b.max >= min && b.min <= max).map((b) => b.id);
}

function mapTiktokCta(cta: string | null): string {
  if (!cta) return 'SHOP_NOW';
  const norm = cta.toLowerCase();
  if (norm.includes('acheter') || norm.includes('shop')) return 'SHOP_NOW';
  if (norm.includes('voir') || norm.includes('see')) return 'VIEW_NOW';
  if (norm.includes('découvrir') || norm.includes('discover')) return 'LEARN_MORE';
  return 'SHOP_NOW';
}

function appendUtm(url: string, storeSlug: string, variantId: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'tiktok');
    u.searchParams.set('utm_medium', 'paid_social');
    u.searchParams.set('utm_campaign', tiktokCampaignName(storeSlug, variantId));
    return u.toString();
  } catch {
    return url;
  }
}

export async function pushTiktokCampaign(args: TiktokPushArgs): Promise<TiktokPushResult> {
  const payload = buildTiktokPayload(args);
  const db = getDb();

  if (!isTiktokAdsConfigured()) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, status, daily_budget_eur,
          targeting_json, push_payload, error_message)
       VALUES ($1, $2, 'tiktok', 'draft', $3, $4, $5, $6)
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        args.dailyBudgetEur,
        args.targeting ? JSON.stringify(args.targeting) : null,
        JSON.stringify(payload),
        'TikTok Ads OAuth not configured',
      ],
    );
    return {
      status: 'draft',
      externalId: null,
      error: 'TikTok Ads OAuth not configured',
      campaignDbId: rows[0]!.id,
    };
  }

  const accessToken = process.env.TIKTOK_ADS_ACCESS_TOKEN!;

  try {
    const campaignRes = await postTiktok(
      `${TIKTOK_API}/campaign/create/`,
      accessToken,
      payload.campaign,
    );
    const campaignId = campaignRes.campaign_id;

    const adgroupRes = await postTiktok(
      `${TIKTOK_API}/adgroup/create/`,
      accessToken,
      { ...payload.adgroup, campaign_id: campaignId },
    );
    const adgroupId = adgroupRes.adgroup_id;

    const adRes = await postTiktok(
      `${TIKTOK_API}/ad/create/`,
      accessToken,
      { ...payload.ad, adgroup_id: adgroupId },
    );

    const externalId = String(campaignId);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, external_id, status,
          daily_budget_eur, targeting_json, push_payload, push_response, pushed_at)
       VALUES ($1, $2, 'tiktok', $3, 'live', $4, $5, $6, $7, now())
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        externalId,
        args.dailyBudgetEur,
        args.targeting ? JSON.stringify(args.targeting) : null,
        JSON.stringify(payload),
        JSON.stringify({ campaign: campaignRes, adgroup: adgroupRes, ad: adRes }),
      ],
    );
    return { status: 'live', externalId, campaignDbId: rows[0]!.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, status, daily_budget_eur,
          targeting_json, push_payload, error_message)
       VALUES ($1, $2, 'tiktok', 'error', $3, $4, $5, $6)
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        args.dailyBudgetEur,
        args.targeting ? JSON.stringify(args.targeting) : null,
        JSON.stringify(payload),
        message.slice(0, 1000),
      ],
    );
    return { status: 'error', externalId: null, error: message, campaignDbId: rows[0]!.id };
  }
}

async function postTiktok(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> & { campaign_id?: string; adgroup_id?: string; ad_id?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': accessToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TikTok API ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { code?: number; message?: string; data?: Record<string, unknown> };
  if (json.code != null && json.code !== 0) {
    throw new Error(`TikTok API code ${json.code}: ${json.message ?? 'unknown error'}`);
  }
  return json.data ?? {};
}
