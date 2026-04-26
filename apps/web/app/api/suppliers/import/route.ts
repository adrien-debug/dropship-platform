import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';

const importSchema = z.object({
  source: z.enum(['aliexpress', 'cj']),
  keywords: z.string().min(1),
  limit: z.number().min(1).max(50).optional().default(20),
  autoImport: z.boolean().optional().default(false),
});

/**
 * POST /api/suppliers/import
 * Recherche + import produits depuis AliExpress ou CJ Dropshipping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = importSchema.parse(body);
    const db = getDb();

    let searchResult: { success: boolean; data?: any; error?: string };

    if (validated.source === 'aliexpress') {
      searchResult = await aliexpress.searchProducts({
        keywords: validated.keywords,
        pageSize: validated.limit,
      });
    } else {
      searchResult = await cj.searchProducts({
        keywords: validated.keywords,
        pageSize: validated.limit,
      });
    }

    if (!searchResult.success || !searchResult.data) {
      return NextResponse.json(
        { success: false, error: searchResult.error || 'Search failed' },
        { status: 503 },
      );
    }

    const products = validated.source === 'aliexpress' 
      ? searchResult.data.products 
      : searchResult.data.list;

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found',
        imported: 0,
        products: [],
      });
    }

    const imported: any[] = [];

    if (validated.autoImport) {
      for (const product of products) {
        try {
          let title: string;
          let price_cents: number;
          let external_id: string;
          let image_url: string;
          let supplier_url: string;

          if (validated.source === 'aliexpress') {
            title = product.product_title || 'Untitled';
            price_cents = Math.round(parseFloat(product.sale_price || product.original_price || '0') * 100);
            external_id = product.product_id;
            image_url = product.product_main_image_url || '';
            supplier_url = product.product_url || '';
          } else {
            title = product.productNameEn || 'Untitled';
            price_cents = Math.round((product.sellPrice || 0) * 100);
            external_id = product.pid;
            image_url = product.productImage || '';
            supplier_url = product.sellUrl || '';
          }

          const { rows } = await db.query(
            `INSERT INTO dropship_products (
              title, description, price_cents, cost_cents, category, supplier, 
              external_id, image_url, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
            RETURNING id, title, price_cents, supplier, external_id`,
            [
              title,
              `Imported from ${validated.source}`,
              price_cents,
              Math.round(price_cents * 0.6), // Cost = 60% of price (example)
              validated.source === 'aliexpress' ? product.category_name : product.categoryName || 'General',
              validated.source,
              external_id,
              image_url,
              'draft',
            ],
          );

          imported.push({ ...rows[0], supplier_url });
        } catch (err) {
          console.error(`[Import] Failed to import product:`, err);
          // Continue with next product
        }
      }
    }

    return NextResponse.json({
      success: true,
      source: validated.source,
      searched: products.length,
      imported: imported.length,
      products: validated.autoImport ? imported : products,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: error.errors },
        { status: 400 },
      );
    }
    console.error('[Import] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
