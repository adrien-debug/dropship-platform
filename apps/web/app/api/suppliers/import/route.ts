import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import type { AliExpressProduct, AliExpressSearchResult } from '@/lib/suppliers/aliexpress';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import type { CJProduct, CJSearchResult } from '@/lib/suppliers/cj';
import * as cj from '@/lib/suppliers/cj';

type SupplierSearchResult =
  | Awaited<ReturnType<typeof aliexpress.searchProducts>>
  | Awaited<ReturnType<typeof cj.searchProducts>>;

interface ImportedProductRow {
  id: string;
  title: string;
  price_cents: number;
  supplier: string;
  external_id: string;
}

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

    let searchResult: SupplierSearchResult;

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

    const products =
      validated.source === 'aliexpress'
        ? (searchResult.data as AliExpressSearchResult).products
        : (searchResult.data as CJSearchResult).list;

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found',
        imported: 0,
        products: [],
      });
    }

    const imported: (ImportedProductRow & { supplier_url: string })[] = [];

    if (validated.autoImport) {
      const insertRow = async (
        title: string,
        price_cents: number,
        external_id: string,
        image_url: string,
        supplier_url: string,
        category: string,
      ) => {
        const { rows } = await db.query<ImportedProductRow>(
          `INSERT INTO dropship_products (
              title, description, price_cents, cost_cents, category, supplier, 
              external_id, image_url, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
            RETURNING id, title, price_cents, supplier, external_id`,
          [
            title,
            `Imported from ${validated.source}`,
            price_cents,
            Math.round(price_cents * 0.6),
            category,
            validated.source,
            external_id,
            image_url,
            'draft',
          ],
        );
        const row = rows[0];
        if (row) imported.push({ ...row, supplier_url });
      };

      if (validated.source === 'aliexpress') {
        for (const product of products as AliExpressProduct[]) {
          try {
            await insertRow(
              product.product_title || 'Untitled',
              Math.round(parseFloat(product.sale_price || product.original_price || '0') * 100),
              product.product_id,
              product.product_main_image_url || '',
              product.product_url || '',
              product.category_name || 'General',
            );
          } catch (err) {
            console.error(`[Import] Failed to import product:`, err);
          }
        }
      } else {
        for (const product of products as CJProduct[]) {
          try {
            await insertRow(
              product.productNameEn || 'Untitled',
              Math.round((product.sellPrice || 0) * 100),
              product.pid,
              product.productImage || '',
              product.sellUrl || '',
              product.categoryName || 'General',
            );
          } catch (err) {
            console.error(`[Import] Failed to import product:`, err);
          }
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
