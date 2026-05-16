import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/super/sessions/:id — full message history of a Super Agent
 * session, ordered chronologically. Used by the floating panel to hydrate
 * the chat when the user reopens a prior conversation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDbRead();
  const sess = await db.query<{
    id: string;
    store_id: string | null;
    title: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, store_id, title, created_at, updated_at
       FROM dropship_copilot_sessions
       WHERE id = $1 AND mode = 'super' LIMIT 1`,
    [id],
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
    [id],
  );

  return NextResponse.json({
    session: sess.rows[0],
    messages: rows,
  });
}

/**
 * DELETE /api/agent/super/sessions/:id — drop the session. Cascade FK takes
 * care of the messages.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const { rowCount } = await db.query(
    `DELETE FROM dropship_copilot_sessions WHERE id = $1 AND mode = 'super'`,
    [id],
  );
  if (rowCount === 0) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
