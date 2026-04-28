import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { medusa } from '@/lib/medusa';

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
const analyticsSchema = z.object({
  ga4MeasurementId: z.string().trim().optional(),
  metaPixelId: z.string().trim().optional(),
  metaCapiToken: z.string().trim().optional(),
  tiktokPixelId: z.string().trim().optional(),
  tiktokEventsToken: z.string().trim().optional(),
  clarityId: z.string().trim().optional(),
});

const patchSchema = z.object({ analytics: analyticsSchema });

const FIELD_TO_COLUMN: Record<keyof z.infer<typeof analyticsSchema>, string> = {
  ga4MeasurementId: 'ga4_measurement_id',
  metaPixelId: 'meta_pixel_id',
  metaCapiToken: 'meta_capi_token',
  tiktokPixelId: 'tiktok_pixel_id',
  tiktokEventsToken: 'tiktok_events_token',
  clarityId: 'clarity_id',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const updates = body.analytics;

    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let i = 1;
    for (const [field, column] of Object.entries(FIELD_TO_COLUMN) as [keyof typeof FIELD_TO_COLUMN, string][]) {
      if (field in updates) {
        const v = updates[field];
        // Empty string clears, non-empty string is the new value.
        setClauses.push(`${column} = $${i}`);
        values.push(v && v.length > 0 ? v : null);
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
