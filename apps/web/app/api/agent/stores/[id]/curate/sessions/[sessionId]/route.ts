import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/stores/:id/curate/sessions/:sessionId — full ordered
 * message history for the session. Used by the chat UI to hydrate when the
 * operator clicks a session in the picker.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id: storeId, sessionId } = await params;
  const db = getDbRead();
  const sess = await db.query<{ id: string }>(
    `SELECT id FROM dropship_curation_sessions WHERE id = $1 AND store_id = $2 LIMIT 1`,
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
       FROM dropship_curation_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return NextResponse.json({ id: sessionId, messages: rows });
}
