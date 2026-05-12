import { getDb } from '@/lib/db';

/**
 * Meta Marketing API push helper.
 *
 * Scope is intentionally minimal: build a campaign + adset + ad payload
 * from a stored ad variant and POST to `act_{accountId}` on Graph API
 * v19. We don't manage budgets long-term, we don't mutate live ads — we
 * push and log. The founder validates inside Business Manager.
 *
 * Fail-soft contract: when OAuth env vars are missing we write a
 * `dropship_ad_campaigns` row with `status='draft'` and an explanatory
 * `error_message`. The UI surfaces a "Configurer Meta Ads OAuth" CTA
 * instead of a blocker, and the founder gets a row in the campaigns log
 * to come back to once OAuth is wired.
 */

const META_GRAPH_API = 'https://graph.facebook.com/v19.0';

export interface MetaPushArgs {
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
  targeting?: MetaTargeting;
}

export interface MetaTargeting {
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 = male, 2 = female. Empty/undefined = all.
  geo_locations?: { countries?: string[] };
  interests?: Array<{ id?: string; name: string }>;
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
}

export interface MetaPushResult {
  status: 'live' | 'draft' | 'error';
  externalId: string | null;
  error?: string;
  campaignDbId: string;
}

/** True iff every env var required for live pushes is set. */
export function isMetaAdsConfigured(): boolean {
  return Boolean(
    process.env.META_ADS_ACCESS_TOKEN &&
      process.env.META_AD_ACCOUNT_ID,
  );
}

/**
 * Deterministic campaign naming so funnel events tagged with `utm_campaign`
 * can be joined back to the campaign row in SQL. Format mirrors the docs:
 *   `dsv-{storeSlug}-{variantId}`
 */
export function metaCampaignName(storeSlug: string, variantId: string): string {
  return `dsv-${storeSlug}-${variantId}`;
}

/**
 * Build the Marketing API payload. Exported so tests can pin the shape
 * without running an HTTP call.
 */
export function buildMetaPayload(args: MetaPushArgs): {
  campaign: Record<string, unknown>;
  adset: Record<string, unknown>;
  ad: Record<string, unknown>;
} {
  const dailyBudgetCents = Math.max(100, Math.round(args.dailyBudgetEur * 100));
  const lifetime = dailyBudgetCents * Math.max(1, args.days);
  const name = metaCampaignName(args.storeSlug, args.variantId);

  const targeting = args.targeting ?? {};
  const geoCountries = targeting.geo_locations?.countries ?? ['FR'];

  return {
    campaign: {
      name,
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adset: {
      name: `${name}-adset`,
      daily_budget: dailyBudgetCents,
      lifetime_budget: lifetime,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: {
        age_min: targeting.age_min ?? 18,
        age_max: targeting.age_max ?? 65,
        genders: targeting.genders && targeting.genders.length > 0 ? targeting.genders : undefined,
        geo_locations: { countries: geoCountries },
        interests: targeting.interests?.length
          ? targeting.interests
          : undefined,
        publisher_platforms: targeting.publisher_platforms ?? ['facebook', 'instagram'],
        facebook_positions: targeting.facebook_positions ?? ['feed'],
        instagram_positions: targeting.instagram_positions ?? ['stream'],
      },
      status: 'PAUSED',
    },
    ad: {
      name: `${name}-ad`,
      status: 'PAUSED',
      creative: {
        name: `${name}-creative`,
        object_story_spec: {
          link_data: {
            message: args.primaryText,
            link: appendUtm(args.productUrl, args.storeSlug, args.variantId, 'meta'),
            name: args.headline,
            description: args.description ?? undefined,
            call_to_action: args.cta
              ? { type: mapMetaCta(args.cta), value: { link: args.productUrl } }
              : undefined,
            picture: args.imageUrl ?? undefined,
          },
        },
      },
    },
  };
}

function mapMetaCta(cta: string): string {
  const norm = cta.toLowerCase();
  if (norm.includes('acheter') || norm.includes('shop')) return 'SHOP_NOW';
  if (norm.includes('découvrir') || norm.includes('discover')) return 'LEARN_MORE';
  if (norm.includes('savoir') || norm.includes('learn')) return 'LEARN_MORE';
  return 'SHOP_NOW';
}

/** Append deterministic UTM params so funnel events can be joined to the campaign. */
function appendUtm(url: string, storeSlug: string, variantId: string, channel: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', channel);
    u.searchParams.set('utm_medium', 'paid_social');
    u.searchParams.set('utm_campaign', metaCampaignName(storeSlug, variantId));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Push a variant to Meta Ads.
 *
 *   - Always inserts a `dropship_ad_campaigns` row (one source of truth for
 *     the UI's performance / log view).
 *   - When OAuth env vars are missing → `status='draft'`, returns 'draft'.
 *   - When the live POST fails  → `status='error'`, returns 'error'.
 *   - On success                → `status='live'`, `external_id` set.
 */
export async function pushMetaCampaign(args: MetaPushArgs): Promise<MetaPushResult> {
  const payload = buildMetaPayload(args);
  const db = getDb();

  if (!isMetaAdsConfigured()) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, status, daily_budget_eur,
          targeting_json, push_payload, error_message)
       VALUES ($1, $2, 'meta', 'draft', $3, $4, $5, $6)
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        args.dailyBudgetEur,
        args.targeting ? JSON.stringify(args.targeting) : null,
        JSON.stringify(payload),
        'Meta Ads OAuth not configured',
      ],
    );
    return {
      status: 'draft',
      externalId: null,
      error: 'Meta Ads OAuth not configured',
      campaignDbId: rows[0]!.id,
    };
  }

  const accessToken = process.env.META_ADS_ACCESS_TOKEN!;
  const accountId = process.env.META_AD_ACCOUNT_ID!.replace(/^act_/, '');

  try {
    // Campaign → adset → ad. Failure of any step throws and we record an
    // error row. We do NOT roll back partial state on Meta — the founder
    // sees a draft campaign in Business Manager and can decide.
    const campaignRes = await postMeta(
      `${META_GRAPH_API}/act_${accountId}/campaigns`,
      accessToken,
      payload.campaign,
    );
    const campaignId = campaignRes.id;

    const adsetRes = await postMeta(
      `${META_GRAPH_API}/act_${accountId}/adsets`,
      accessToken,
      { ...payload.adset, campaign_id: campaignId },
    );
    const adsetId = adsetRes.id;

    const adRes = await postMeta(
      `${META_GRAPH_API}/act_${accountId}/ads`,
      accessToken,
      { ...payload.ad, adset_id: adsetId },
    );

    const externalId = String(campaignId);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, external_id, status,
          daily_budget_eur, targeting_json, push_payload, push_response, pushed_at)
       VALUES ($1, $2, 'meta', $3, 'live', $4, $5, $6, $7, now())
       RETURNING id`,
      [
        args.storeId,
        args.variantId,
        externalId,
        args.dailyBudgetEur,
        args.targeting ? JSON.stringify(args.targeting) : null,
        JSON.stringify(payload),
        JSON.stringify({ campaign: campaignRes, adset: adsetRes, ad: adRes }),
      ],
    );
    return { status: 'live', externalId, campaignDbId: rows[0]!.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_ad_campaigns
         (store_id, variant_id, channel, status, daily_budget_eur,
          targeting_json, push_payload, error_message)
       VALUES ($1, $2, 'meta', 'error', $3, $4, $5, $6)
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

async function postMeta(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ id: string; [k: string]: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: accessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Meta API ${res.status}: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as { id: string };
}
