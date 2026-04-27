import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
    tagline: string;
    logo_emoji: string;
    primary_color: string;
    accent_color: string;
    status: string;
    product_count: number;
    created_at: string;
  }>(
    `SELECT id, slug, name, niche, tagline, logo_emoji, primary_color, accent_color,
            status, product_count, created_at
     FROM dropship_stores
     ORDER BY created_at DESC
     LIMIT 100`,
  );
  return NextResponse.json({ stores: rows });
}
