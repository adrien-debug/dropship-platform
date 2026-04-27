import { NextRequest, NextResponse } from 'next/server';
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
