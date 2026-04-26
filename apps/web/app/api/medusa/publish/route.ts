import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { medusa, publishToMedusa } from '@/lib/medusa';
import { getDb, type Product } from '@/lib/db';

const publishSchema = z.object({
  productIds: z.array(z.string()).min(1),
  autoPublish: z.boolean().optional().default(false),
});

/**
 * POST /api/medusa/publish
 * Publish dropship_products from Railway Postgres to Medusa
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const validated = publishSchema.parse(body);

    const configCheck = medusa.checkConfig();
    if (!configCheck.ok) {
      return NextResponse.json({ success: false, error: configCheck.message }, { status: 503 });
    }

    const placeholders = validated.productIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: products } = await db.query<Product>(
      `SELECT * FROM dropship_products WHERE id = ANY(ARRAY[${placeholders}]::uuid[])`,
      validated.productIds,
    );

    if (!products || products.length === 0) {
      return NextResponse.json({ success: false, error: 'No products found' }, { status: 404 });
    }

    const results: { supabaseId: string; medusaId: string; title: string; status: string }[] = [];
    const errors: { supabaseId: string; title: string; error: string }[] = [];

    for (const product of products) {
      try {
        const result = await publishToMedusa({
          title: product.title,
          description: product.description || '',
          price_cents: product.price_cents,
          cost_cents: product.cost_cents || Math.round(product.price_cents * 0.5),
          category: product.category || 'General',
          supplier: product.supplier || 'unknown',
          external_id: product.id,
          image_url: product.image_url || '',
          metadata: {
            original_status: product.status,
            supplier_external_id: product.external_id,
            imported_at: new Date().toISOString(),
          },
        });

        if (result.success && result.product) {
          await db.query(
            `UPDATE dropship_products SET
               medusa_product_id = $1,
               published_to_medusa_at = $2,
               status = $3,
               updated_at = now()
             WHERE id = $4`,
            [
              result.product.id,
              new Date().toISOString(),
              validated.autoPublish ? 'published' : 'draft',
              product.id,
            ],
          );

          results.push({
            supabaseId: product.id,
            medusaId: result.product.id,
            title: result.product.title,
            status: 'success',
          });
        } else {
          errors.push({ supabaseId: product.id, title: product.title, error: result.error || 'Unknown error' });
        }
      } catch (err) {
        errors.push({
          supabaseId: product.id,
          title: product.title,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      published: {
        total: products.length,
        success: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: error.errors },
        { status: 400 },
      );
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('DATABASE_URL')) {
      return NextResponse.json({ success: false, error: msg }, { status: 503 });
    }
    console.error('[Medusa Publish] Error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * GET /api/medusa/publish
 * Stats de publication depuis Railway Postgres
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (productId) {
      const { rows } = await db.query<Product>(
        `SELECT id, title, medusa_product_id, published_to_medusa_at, status
         FROM dropship_products WHERE id = $1`,
        [productId],
      );
      if (!rows[0]) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        product: { ...rows[0], isPublishedToMedusa: !!rows[0].medusa_product_id },
      });
    }

    const { rows: published } = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dropship_products WHERE medusa_product_id IS NOT NULL`,
    );
    const { rows: notPublished } = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dropship_products WHERE medusa_product_id IS NULL`,
    );

    return NextResponse.json({
      success: true,
      stats: {
        publishedToMedusa: parseInt(published[0]?.count || '0', 10),
        notPublished: parseInt(notPublished[0]?.count || '0', 10),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('DATABASE_URL')) {
      return NextResponse.json({ success: false, error: msg }, { status: 503 });
    }
    console.error('[Medusa Publish Status] Error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
