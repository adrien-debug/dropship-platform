import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import {
  createCurationSession,
  runCurationTurn,
  type CurationStreamEvent,
} from '@/lib/agent/curation-copilot';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

/**
 * POST /api/agent/stores/:id/curate
 * Body: { sessionId?, message }
 * Streams Server-Sent Events from the curation copilot. If no sessionId is
 * provided, a fresh session is created and its id is announced via a
 * `session_created` synthetic event before the run starts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Cap chat at 30 turns/min/IP. The middleware already gates /api/agent/*
  // with Basic auth, but a panicked Enter-spammer shouldn't burn Sonnet credits.
  const rl = await checkRateLimit(`curate:${clientIp(req)}`, { max: 30, windowSec: 60 });
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

  const { id: storeId } = await params;

  let input;
  try {
    input = schema.parse(await req.json());
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid input' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate store exists + own the session belongs to this store. Doing
  // this here (rather than inside the streamed generator) lets us return a
  // proper 404 / 403 before opening the SSE.
  const db = getDb();
  const storeRow = await db.query<{ id: string }>(
    `SELECT id FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  if (!storeRow.rows[0]) {
    return new Response(JSON.stringify({ error: 'Store not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sessionId = input.sessionId;
  if (sessionId) {
    const sess = await db.query<{ id: string }>(
      `SELECT id FROM dropship_curation_sessions WHERE id = $1 AND store_id = $2 LIMIT 1`,
      [sessionId, storeId],
    );
    if (!sess.rows[0]) {
      return new Response(
        JSON.stringify({ error: 'Session not found for this store' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } else {
    sessionId = await createCurationSession(storeId);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; data: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send({ type: 'session', data: { sessionId } });

      try {
        for await (const event of runCurationTurn(storeId, sessionId!, input.message)) {
          send(event as CurationStreamEvent);
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
