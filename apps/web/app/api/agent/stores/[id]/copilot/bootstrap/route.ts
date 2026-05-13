import { NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import type { CopilotMode } from '@/lib/agent/copilot-router';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/stores/:id/copilot/bootstrap
 *
 * Returns all data needed to bootstrap the persistent copilot for a store:
 *   - store metadata
 *   - all sessions (for every mode)
 *   - products (for curation context)
 *
 * Called client-side when the user navigates to a store route.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDbRead();

  const storeRes = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
    logo_emoji: string;
    primary_color: string;
    status: string;
    mode: string | null;
  }>(
    `SELECT id, slug, name, niche, logo_emoji, primary_color, status, mode
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const sessionsRes = await db.query<{
    id: string;
    mode: CopilotMode;
    title: string | null;
    created_at: string;
    updated_at: string;
    preview: string | null;
    preview_role: 'user' | 'assistant' | null;
    message_count: number;
  }>(
    `SELECT s.id, s.mode, s.title, s.created_at, s.updated_at,
            (SELECT content FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview,
            (SELECT role FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview_role,
            (SELECT COUNT(*) FROM dropship_copilot_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_copilot_sessions s
       WHERE s.store_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 100`,
    [id],
  );

  const productsRes = await db.query<{
    id: string;
    enriched_title: string;
    price_cents: number;
    image_url: string | null;
  }>(
    `SELECT id, enriched_title, price_cents, image_url
       FROM dropship_store_products
       WHERE store_id = $1
       ORDER BY created_at ASC`,
    [id],
  );

  return NextResponse.json({
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    storeNiche: store.niche,
    logoEmoji: store.logo_emoji,
    primaryColor: store.primary_color,
    status: store.status,
    mode: store.mode,
    sessions: sessionsRes.rows,
    products: productsRes.rows,
  });
}
