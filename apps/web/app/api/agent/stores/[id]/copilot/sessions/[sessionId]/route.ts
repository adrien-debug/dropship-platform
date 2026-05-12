import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/stores/:id/copilot/sessions/:sessionId — full ordered
 * message history for the session. Mirrors the curate route but reads from
 * `dropship_copilot_messages`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id: storeId, sessionId } = await params;
  const db = getDbRead();
  const sess = await db.query<{ id: string; mode: string; title: string | null }>(
    `SELECT id, mode, title FROM dropship_copilot_sessions
      WHERE id = $1 AND store_id = $2 LIMIT 1`,
    [sessionId, storeId],
  );
  if (!sess.rows[0]) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  const { rows } = await db.query<{
    id: string;
    role: string;
    content: string;
    tool_name: string | null;
    tool_input: unknown;
    tool_output: unknown;
    created_at: string;
  }>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_copilot_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return NextResponse.json({
    id: sessionId,
    mode: sess.rows[0].mode,
    title: sess.rows[0].title,
    messages: rows,
  });
}
