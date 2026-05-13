import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { medusa } from '@/lib/medusa';
import { encryptSecret, secretsConfigured } from '@/lib/secrets';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const { rows } = await db.query<{
    medusa_sales_channel_id: string | null;
    medusa_publishable_key: string | null;
  }>(
    'SELECT medusa_sales_channel_id, medusa_publishable_key FROM dropship_stores WHERE id = $1',
    [id],
  );

  if (!rows[0]) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  // Get all Medusa products linked to this store and delete them
  const { rows: products } = await db.query<{ medusa_product_id: string }>(
    'SELECT medusa_product_id FROM dropship_store_products WHERE store_id = $1 AND medusa_product_id IS NOT NULL',
    [id],
  );

  for (const { medusa_product_id } of products) {
    await medusa.deleteProduct(medusa_product_id).catch(() => {});
  }

  // Delete from DB
  await db.query('DELETE FROM dropship_store_products WHERE store_id = $1', [id]);
  await db.query('DELETE FROM dropship_stores WHERE id = $1', [id]);

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/agent/stores/:id — update editable per-store fields. Currently
 * scoped to the analytics block (pixel IDs, CAPI tokens, Clarity ID). The
 * middleware already enforces admin Basic auth on /api/agent/*.
 *
 * All fields are optional; the body shape is { analytics: { ... } }. An
 * explicit empty string clears a previously-set value, an absent key
 * leaves it untouched.
 */
// Loose but safe: allow empty string (clears the field) or known safe formats.
// These values are embedded in inline <script> tags — reject anything that
// could break out of a JS string literal.
const safeId = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || pattern.test(v), { message: 'Format invalide' })
    .optional();

const analyticsSchema = z.object({
  ga4MeasurementId: safeId(/^G-[A-Z0-9]{4,12}$/),
  // GA4 Measurement Protocol api_secret: short alphanum + - _ token Google
  // exposes once in the Admin → Data Streams → Measurement Protocol UI.
  ga4ApiSecret: safeId(/^[A-Za-z0-9_-]{1,100}$/),
  metaPixelId: safeId(/^\d{10,20}$/),
  metaCapiToken: z.string().trim().max(512).optional(),
  tiktokPixelId: safeId(/^C[A-Z0-9]{10,25}$/),
  tiktokEventsToken: z.string().trim().max(512).optional(),
  clarityId: safeId(/^[a-z0-9]{6,20}$/),
  // Google Ads: plain fields, not secrets — no encryption needed.
  googleAdsConversionAction: z.string().trim().max(256).optional(),
  googleAdsMerchantId: safeId(/^\d{6,20}$/),
});

const templateSchema = z.enum([
  'auto',
  'mono',
  'collection-grid',
  'collection-editorial',
  'luxury-minimal',
  'gen-z-bold',
]);

// P1.1: custom domain — apex hostname like "maison-chic.com". Empty string clears it.
// Accepts: lowercase alphanumeric, hyphens, dots; at least one dot; valid TLD (2+ chars).
const customDomainSchema = safeId(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\.[a-z]{2,}$/);

// P1.4: storefront template is a top-level field — distinct from the
// analytics block so the form can submit a single field without echoing
// the full analytics payload.
const patchSchema = z
  .object({
    analytics: analyticsSchema.optional(),
    template: templateSchema.optional(),
    customDomain: customDomainSchema,
  })
  .refine(
    (v) => v.analytics !== undefined || v.template !== undefined || v.customDomain !== undefined,
    { message: 'analytics, template, or customDomain required' },
  );

// Plain text fields — written as-is to a single column.
const PLAIN_FIELD_TO_COLUMN: Record<
  | Exclude<
      keyof z.infer<typeof analyticsSchema>,
      'metaCapiToken' | 'tiktokEventsToken' | 'ga4ApiSecret'
    >
  | 'customDomain',
  string
> = {
  ga4MeasurementId: 'ga4_measurement_id',
  metaPixelId: 'meta_pixel_id',
  tiktokPixelId: 'tiktok_pixel_id',
  clarityId: 'clarity_id',
  googleAdsConversionAction: 'google_ads_conversion_action',
  googleAdsMerchantId: 'google_merchant_id',
  // P1.1: custom domain
  customDomain: 'custom_domain',
};

// Secret fields — encrypted at rest. Each field maps to three columns:
// the legacy plain column (cleared on write) plus the ciphertext / nonce
// pair. The read path (lib/store-config.ts) prefers the encrypted columns
// and falls back to the plain one for legacy rows.
const SECRET_FIELD_TO_COLUMNS: Record<
  'metaCapiToken' | 'tiktokEventsToken' | 'ga4ApiSecret',
  { plain: string; enc: string; nonce: string }
> = {
  metaCapiToken: {
    plain: 'meta_capi_token',
    enc: 'meta_capi_token_enc',
    nonce: 'meta_capi_token_nonce',
  },
  tiktokEventsToken: {
    plain: 'tiktok_events_token',
    enc: 'tiktok_events_token_enc',
    nonce: 'tiktok_events_token_nonce',
  },
  ga4ApiSecret: {
    plain: 'ga4_api_secret',
    enc: 'ga4_api_secret_enc',
    nonce: 'ga4_api_secret_nonce',
  },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const updates = body.analytics ?? {};

    const setClauses: string[] = [];
    const values: (string | Buffer | null)[] = [];
    let i = 1;

    if (body.template) {
      setClauses.push(`template = $${i}`);
      values.push(body.template);
      i++;
    }

    // P1.1: customDomain is a top-level field (not inside analytics).
    if (body.customDomain !== undefined) {
      const v = body.customDomain;
      setClauses.push(`custom_domain = $${i}`);
      values.push(v && v.length > 0 ? v : null);
      i++;
    }

    for (const [field, column] of Object.entries(PLAIN_FIELD_TO_COLUMN) as [
      keyof typeof PLAIN_FIELD_TO_COLUMN,
      string,
    ][]) {
      // customDomain is handled above as a top-level field; skip it here.
      if (field === 'customDomain') continue;
      if (field in updates) {
        const v = updates[field as keyof typeof updates];
        setClauses.push(`${column} = $${i}`);
        values.push(v && v.length > 0 ? v : null);
        i++;
      }
    }

    for (const [field, cols] of Object.entries(SECRET_FIELD_TO_COLUMNS) as [
      keyof typeof SECRET_FIELD_TO_COLUMNS,
      { plain: string; enc: string; nonce: string },
    ][]) {
      if (!(field in updates)) continue;
      const v = updates[field];
      // QW4: always wipe the legacy plain column on any secret write so a
      // half-encrypted state cannot persist. Either we encrypt the new
      // value into the cipher pair, or we clear all three.
      setClauses.push(`${cols.plain} = $${i}`);
      values.push(null);
      i++;
      if (v && v.length > 0) {
        if (!secretsConfigured()) {
          return NextResponse.json(
            { success: false, error: 'STORE_SECRETS_KEY is not configured — cannot store secret token.' },
            { status: 500 },
          );
        }
        const { encrypted, nonce } = encryptSecret(v);
        setClauses.push(`${cols.enc} = $${i}`);
        values.push(encrypted);
        i++;
        setClauses.push(`${cols.nonce} = $${i}`);
        values.push(nonce);
        i++;
      } else {
        // Clearing the field — wipe both cipher columns too.
        setClauses.push(`${cols.enc} = $${i}`);
        values.push(null);
        i++;
        setClauses.push(`${cols.nonce} = $${i}`);
        values.push(null);
        i++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }
    setClauses.push(`updated_at = now()`);
    values.push(id);
    const { rowCount } = await getDb().query(
      `UPDATE dropship_stores SET ${setClauses.join(', ')} WHERE id = $${i}`,
      values,
    );
    if (!rowCount) return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid params', details: e.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    );
  }
}
