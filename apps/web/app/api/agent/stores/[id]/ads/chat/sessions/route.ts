import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import { createAdsSession } from '@/lib/agent/ads-copilot';

export const dynamic = 'force-dynamic';

/** GET — list recent ads-chat sessions for this store. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storeId } = await params;
  const db = getDbRead();
  const { rows } = await db.query<{
    id: string;
    created_at: string;
    updated_at: string;
    last_message_role: string | null;
    last_message_content: string | null;
    message_count: number;
  }>(
    `SELECT s.id, s.created_at, s.updated_at,
            (SELECT role FROM dropship_curation_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
            (SELECT content FROM dropship_curation_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_content,
            (SELECT COUNT(*) FROM dropship_curation_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_curation_sessions s
       WHERE s.store_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 50`,
    [storeId],
  );
  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      message_count: r.message_count,
      preview: r.last_message_content?.slice(0, 140) ?? null,
      preview_role: r.last_message_role,
    })),
  });
}

/** POST — create a fresh ads-chat session. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storeId } = await params;
  const db = getDbRead();
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  const sessionId = await createAdsSession(storeId);
  return NextResponse.json({ id: sessionId });
}
