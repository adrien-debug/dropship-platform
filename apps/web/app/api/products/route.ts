import { NextRequest, NextResponse } from 'next/server';
import { getDb, type Product } from '@/lib/db';

const TABLE = 'dropship_products';

const STATUS_FILTER = new Set(['draft', 'published', 'rejected', 'proposed']);

/**
 * GET /api/products?status=all|draft|published&limit=50
 * Liste les produits dropship (Railway Postgres `dropship_products`).
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const statusRaw = (searchParams.get('status') || 'all').toLowerCase();
    const limitRaw = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    if (statusRaw !== 'all' && !STATUS_FILTER.has(statusRaw)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status (use all, draft, published, rejected, proposed)', products: [] },
        { status: 400 },
      );
    }

    const params: unknown[] = [];
    let sql = `SELECT * FROM ${TABLE}`;
    if (statusRaw !== 'all') {
      params.push(statusRaw);
      sql += ` WHERE status = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY updated_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query<Product>(sql, params);

    return NextResponse.json({ success: true, products: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('DATABASE_URL')) {
      return NextResponse.json({ success: false, error: msg, products: [] }, { status: 503 });
    }
    console.error('[Products list] Error:', error);
    return NextResponse.json({ success: false, error: msg, products: [] }, { status: 500 });
  }
}
