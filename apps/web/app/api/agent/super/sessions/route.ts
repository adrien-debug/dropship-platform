import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbRead } from '@/lib/db';
import { createSuperAgentSession } from '@/lib/agent/super-agent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/super/sessions?storeId=&limit=
 * List recent Super Agent sessions. Optional `storeId` filter; without it
 * returns global sessions (store_id IS NULL) and per-store mixed.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const storeId = url.searchParams.get('storeId');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '30')));

  const db = getDbRead();
  const { rows } = await db.query<{
    id: string;
    store_id: string | null;
    title: string | null;
    created_at: string;
    updated_at: string;
    last_message_role: 'user' | 'assistant' | 'tool' | null;
    last_message_content: string | null;
    message_count: number;
    store_name: string | null;
  }>(
    `SELECT s.id, s.store_id, s.title, s.created_at, s.updated_at,
            (SELECT role FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
            (SELECT content FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_content,
            (SELECT COUNT(*) FROM dropship_copilot_messages m WHERE m.session_id = s.id)::int AS message_count,
            (SELECT name FROM dropship_stores st WHERE st.id = s.store_id) AS store_name
       FROM dropship_copilot_sessions s
       WHERE s.mode = 'super'
         AND ($1::uuid IS NULL OR s.store_id = $1)
       ORDER BY s.updated_at DESC
       LIMIT $2`,
    [storeId, limit],
  );

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      store_id: r.store_id,
      store_name: r.store_name,
      title: r.title,
      created_at: r.created_at,
      updated_at: r.updated_at,
      message_count: r.message_count,
      preview: r.last_message_content?.slice(0, 140) ?? null,
      preview_role: r.last_message_role,
    })),
  });
}

const postSchema = z.object({
  storeId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/agent/super/sessions
 * Body: { storeId?, title? } — creates an empty session.
 */
export async function POST(req: NextRequest) {
  let body;
  try {
    body = postSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid input' },
      { status: 400 },
    );
  }
  const sessionId = await createSuperAgentSession(body.storeId ?? null, body.title ?? null);
  return NextResponse.json({ id: sessionId });
}
