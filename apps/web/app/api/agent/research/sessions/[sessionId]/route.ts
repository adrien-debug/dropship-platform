import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/research/sessions/:sessionId
 * Returns the ordered message history (user/assistant/tool rows) plus
 * the session row (title, updated_at). Used by the chat UI to hydrate
 * when the operator clicks a past session in the picker.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const db = getDbRead();
  const sess = await db.query<{
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, title, created_at, updated_at
       FROM dropship_research_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
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
       FROM dropship_research_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );

  // Surface the latest AI cost (sum across this turn-trail). The UI
  // shows it as a small "X tokens · ~Y €" footer. We sum across the
  // session's full lifetime — close enough for a research session
  // since sessions are short-lived in practice.
  const cost = await db.query<{
    total_input: number;
    total_output: number;
    total_cost_eur: number;
  }>(
    `SELECT COALESCE(SUM(input_tokens),0)::int AS total_input,
            COALESCE(SUM(output_tokens),0)::int AS total_output,
            COALESCE(SUM(cost_eur),0)::numeric AS total_cost_eur
       FROM dropship_ai_runs
      WHERE step = 'research-turn'
        AND created_at >= (SELECT created_at FROM dropship_research_sessions WHERE id = $1)`,
    [sessionId],
  );

  return NextResponse.json({
    id: sess.rows[0].id,
    title: sess.rows[0].title,
    created_at: sess.rows[0].created_at,
    updated_at: sess.rows[0].updated_at,
    messages: rows,
    cost: {
      input_tokens: cost.rows[0]?.total_input ?? 0,
      output_tokens: cost.rows[0]?.total_output ?? 0,
      cost_eur: Number(cost.rows[0]?.total_cost_eur ?? 0),
    },
  });
}
