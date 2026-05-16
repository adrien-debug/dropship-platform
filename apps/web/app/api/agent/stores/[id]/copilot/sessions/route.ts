import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbRead, getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import {
  COPILOT_MODES,
  createCopilotSession,
  type CopilotMode,
} from '@/lib/agent/copilot-router';

export const dynamic = 'force-dynamic';

const modeEnum = z.enum(COPILOT_MODES as readonly [CopilotMode, ...CopilotMode[]]);

/**
 * GET /api/agent/stores/:id/copilot/sessions?mode=ads
 * Optional `mode` filter; without it the list is grouped per mode for the
 * sidebar header.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const url = new URL(req.url);
  const modeParam = url.searchParams.get('mode');
  const parsedMode = modeParam ? modeEnum.safeParse(modeParam) : null;
  const mode = parsedMode?.success ? parsedMode.data : null;

  const db = getDbRead();
  const { rows } = await db.query<{
    id: string;
    mode: CopilotMode;
    title: string | null;
    created_at: string;
    updated_at: string;
    last_message_role: 'user' | 'assistant' | 'tool' | null;
    last_message_content: string | null;
    message_count: number;
  }>(
    `SELECT s.id, s.mode, s.title, s.created_at, s.updated_at,
            (SELECT role FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
            (SELECT content FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_content,
            (SELECT COUNT(*) FROM dropship_copilot_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_copilot_sessions s
       WHERE s.store_id = $1
         AND ($2::text IS NULL OR s.mode = $2)
       ORDER BY s.updated_at DESC
       LIMIT 50`,
    [storeId, mode],
  );

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      mode: r.mode,
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
  mode: modeEnum,
  title: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/agent/stores/:id/copilot/sessions
 * Body: { mode, title? } — creates an empty session.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  let body;
  try {
    body = postSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid input' },
      { status: 400 },
    );
  }
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  const sessionId = await createCopilotSession(storeId, body.mode, body.title ?? null);
  return NextResponse.json({ id: sessionId, mode: body.mode });
}
