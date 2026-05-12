import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';
import { createResearchSession } from '@/lib/agent/research-copilot';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/research/sessions
 * List the 50 most recent research sessions (across all niches — there
 * is no store binding). Each row carries the title, an updated_at
 * timestamp, and the first-user-message preview so the picker can show
 * something meaningful.
 */
export async function GET() {
  const db = getDbRead();
  const { rows } = await db.query<{
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
    first_user_message: string | null;
    message_count: number;
  }>(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            (SELECT content FROM dropship_research_messages m
                WHERE m.session_id = s.id AND m.role = 'user'
                ORDER BY m.created_at ASC, m.id ASC LIMIT 1) AS first_user_message,
            (SELECT COUNT(*) FROM dropship_research_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_research_sessions s
       ORDER BY s.updated_at DESC
       LIMIT 50`,
  );
  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      title: r.title,
      created_at: r.created_at,
      updated_at: r.updated_at,
      message_count: r.message_count,
      preview: (r.title ?? r.first_user_message ?? '').slice(0, 140) || null,
    })),
  });
}

/**
 * POST /api/agent/research/sessions
 * Create an empty session. Returns { id }.
 */
export async function POST(_req: NextRequest) {
  const id = await createResearchSession();
  return NextResponse.json({ id });
}
