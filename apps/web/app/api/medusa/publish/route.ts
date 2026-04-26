import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { medusa, publishToMedusa } from '@/lib/medusa';
import { getSupabase } from '@/lib/supabase';

const publishSchema = z.object({
  productIds: z.array(z.string()).min(1),
  autoPublish: z.boolean().optional().default(false),
});

/**
 * POST /api/medusa/publish
 * Publish products from Supabase to Medusa
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const validated = publishSchema.parse(body);

    // Check Medusa config
    const configCheck = medusa.checkConfig();
    if (!configCheck.ok) {
      return NextResponse.json(
        { success: false, error: configCheck.message },
        { status: 503 }
      );
    }

    // Fetch products from Supabase
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', validated.productIds);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products found' },
        { status: 404 }
      );
    }

    // Publish each product to Medusa
    const results = [];
    const errors = [];

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
          // Update product in Supabase with Medusa ID
          await supabase
            .from('products')
            .update({
              medusa_product_id: result.product.id,
              published_to_medusa_at: new Date().toISOString(),
              status: validated.autoPublish ? 'published' : 'draft',
            })
            .eq('id', product.id);

          results.push({
            supabaseId: product.id,
            medusaId: result.product.id,
            title: result.product.title,
            status: 'success',
          });
        } else {
          errors.push({
            supabaseId: product.id,
            title: product.title,
            error: result.error || 'Unknown error',
          });
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
        { status: 400 }
      );
    }

    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('Supabase non configuré')) {
      return NextResponse.json({ success: false, error: msg }, { status: 503 });
    }

    console.error('[Medusa Publish] Error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * GET /api/medusa/publish/status
 * Get publish status for products
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (productId) {
      // Check specific product
      const { data: product, error } = await supabase
        .from('products')
        .select('id, title, medusa_product_id, published_to_medusa_at, status')
        .eq('id', productId)
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        product: {
          ...product,
          isPublishedToMedusa: !!product.medusa_product_id,
        },
      });
    }

    // Get stats
    const { data: stats, error: statsError } = await supabase
      .from('products')
      .select('medusa_product_id')
      .not('medusa_product_id', 'is', null);

    if (statsError) {
      throw new Error(`Failed to fetch stats: ${statsError.message}`);
    }

    const { data: notPublished } = await supabase
      .from('products')
      .select('id')
      .is('medusa_product_id', null);

    return NextResponse.json({
      success: true,
      stats: {
        publishedToMedusa: stats?.length || 0,
        notPublished: notPublished?.length || 0,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('Supabase non configuré')) {
      return NextResponse.json({ success: false, error: msg }, { status: 503 });
    }
    console.error('[Medusa Publish Status] Error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
