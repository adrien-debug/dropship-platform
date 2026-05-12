import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { pushMetaCampaign } from '@/lib/ads/meta-ads';
import { pushTiktokCampaign } from '@/lib/ads/tiktok-ads';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  variantId: z.string().uuid(),
  channel: z.enum(['meta', 'tiktok']),
  daily_budget_eur: z.number().positive().max(10_000),
  days: z.number().int().positive().max(90),
});

interface VariantRow {
  id: string;
  store_id: string;
  product_id: string;
  channel: 'meta' | 'tiktok' | 'google';
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string | null;
  meta: unknown;
  targeting_json: unknown;
  store_slug: string;
  product_title: string;
  product_image_url: string | null;
  product_medusa_id: string | null;
}

/**
 * POST /api/agent/stores/:id/ads/push
 * Body: { variantId, channel, daily_budget_eur, days }
 *
 * Always returns 200 with { status, external_id?, error? } — even on
 * channel failure or OAuth-not-configured. The error is surfaced via
 * the `status='error' | 'draft'` field so the UI can render a clean
 * state instead of a 500.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(`ads-push:${clientIp(req)}`, { max: 20, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit reached. Retry in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const { id: storeId } = await params;

  let input;
  try {
    input = schema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid input' },
      { status: 400 },
    );
  }

  const db = getDb();
  const { rows } = await db.query<VariantRow>(
    `SELECT v.id, v.store_id, v.product_id, v.channel,
            v.headline, v.primary_text, v.description, v.cta,
            v.meta, v.targeting_json,
            s.slug AS store_slug,
            p.enriched_title AS product_title,
            p.image_url AS product_image_url,
            p.medusa_product_id AS product_medusa_id
       FROM dropship_ad_variants v
       JOIN dropship_stores s ON s.id = v.store_id
       JOIN dropship_store_products p ON p.id = v.product_id
       WHERE v.id = $1 AND v.store_id = $2 LIMIT 1`,
    [input.variantId, storeId],
  );
  const variant = rows[0];
  if (!variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
  }
  if (variant.channel === 'google') {
    return NextResponse.json({
      status: 'draft',
      error: 'Google Ads push not supported yet — copy the hook manually into Google Ads.',
    });
  }
  if (variant.channel !== input.channel) {
    return NextResponse.json(
      { error: `Variant channel (${variant.channel}) does not match requested channel (${input.channel})` },
      { status: 400 },
    );
  }

  const variantMeta = isPlainObject(variant.meta) ? variant.meta : {};
  const imageUrl = typeof variantMeta.image_url === 'string' ? variantMeta.image_url : variant.product_image_url;
  const videoUrl = typeof variantMeta.video_url === 'string' ? variantMeta.video_url : null;

  // Build a public product URL. We don't have NEXT_PUBLIC_SITE_URL on every
  // env so we fall back to a relative path — the deterministic UTM tag is
  // what matters for funnel-event attribution, not the absolute origin.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
  const productUrl = `${origin || ''}/shop/${variant.store_slug}/products/${variant.product_medusa_id ?? variant.product_id}`;

  const targeting = isPlainObject(variant.targeting_json) ? variant.targeting_json : undefined;

  try {
    if (input.channel === 'meta') {
      const result = await pushMetaCampaign({
        storeId,
        storeSlug: variant.store_slug,
        variantId: variant.id,
        headline: variant.headline,
        primaryText: variant.primary_text,
        description: variant.description,
        cta: variant.cta,
        imageUrl,
        productUrl,
        dailyBudgetEur: input.daily_budget_eur,
        days: input.days,
        targeting: targeting as Parameters<typeof pushMetaCampaign>[0]['targeting'],
      });
      return NextResponse.json({
        status: result.status,
        external_id: result.externalId,
        error: result.error,
        campaign_id: result.campaignDbId,
      });
    }
    const result = await pushTiktokCampaign({
      storeId,
      storeSlug: variant.store_slug,
      variantId: variant.id,
      headline: variant.headline,
      primaryText: variant.primary_text,
      description: variant.description,
      cta: variant.cta,
      imageUrl,
      videoUrl,
      productUrl,
      dailyBudgetEur: input.daily_budget_eur,
      days: input.days,
      targeting: targeting as Parameters<typeof pushTiktokCampaign>[0]['targeting'],
    });
    return NextResponse.json({
      status: result.status,
      external_id: result.externalId,
      error: result.error,
      campaign_id: result.campaignDbId,
    });
  } catch (err) {
    // Should not happen — the push helpers swallow their own errors into
    // a status='error' row. This is the belt-and-suspenders fallback.
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ status: 'error', error: message });
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
