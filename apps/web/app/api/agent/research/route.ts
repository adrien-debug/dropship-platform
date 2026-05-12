import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { getDbRead } from '@/lib/db';
import {
  createResearchSession,
  runResearchTurn,
  type ResearchStreamEvent,
} from '@/lib/agent/research-copilot';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

/**
 * POST /api/agent/research
 * Body: { sessionId?, message }
 *
 * Streams Server-Sent Events from the research copilot. If no sessionId is
 * provided, a fresh session is created and announced via a `session` event
 * before the run starts.
 *
 * Rate-limited 30 turns/min/IP — same envelope as the curation copilot.
 */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`research:${clientIp(req)}`, {
    max: 30,
    windowSec: 60,
  });
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: `Rate limit reached. Retry in ${rl.retryAfterSec}s.` }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSec),
        },
      },
    );
  }

  let input;
  try {
    input = schema.parse(await req.json());
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid input' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let sessionId = input.sessionId;
  if (sessionId) {
    // Verify the session exists. Unlike curation sessions, research
    // sessions are not scoped to a store — only existence + UUID match.
    const db = getDbRead();
    const sess = await db.query<{ id: string }>(
      `SELECT id FROM dropship_research_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!sess.rows[0]) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    sessionId = await createResearchSession();
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; data: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send({ type: 'session', data: { sessionId } });

      try {
        for await (const event of runResearchTurn(sessionId!, input.message)) {
          send(event as ResearchStreamEvent);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (err) {
        send({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Erreur serveur' },
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
