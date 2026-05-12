import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import {
  COPILOT_MODES,
  createCopilotSession,
  runCopilotTurn,
  type CopilotMode,
  type CopilotStreamEvent,
} from '@/lib/agent/copilot-router';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const modeEnum = z.enum(COPILOT_MODES as readonly [CopilotMode, ...CopilotMode[]]);

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  mode: modeEnum,
  message: z.string().min(1).max(8000),
  autoPushConfirmed: z.boolean().optional(),
});

/**
 * POST /api/agent/stores/:id/copilot
 * Body: { sessionId?, mode, message, autoPushConfirmed? }
 *
 * Single SSE endpoint for the per-store Copilote hub. Dispatches to the
 * mode binding via `runCopilotTurn`. Rate limit is 60/min/IP because Dev
 * mode legitimately chains many tool calls in quick succession.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await checkRateLimit(`copilot:${clientIp(req)}`, { max: 60, windowSec: 60 });
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
    const sess = await db.query<{ id: string; mode: string }>(
      `SELECT id, mode FROM dropship_copilot_sessions
        WHERE id = $1 AND store_id = $2 LIMIT 1`,
      [sessionId, storeId],
    );
    if (!sess.rows[0]) {
      return new Response(
        JSON.stringify({ error: 'Session not found for this store' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (sess.rows[0].mode !== input.mode) {
      // Sessions are mode-bound. A mode switch on the client should create a
      // new session — surface this rather than silently mixing tool surfaces.
      return new Response(
        JSON.stringify({ error: `Session is for mode '${sess.rows[0].mode}', not '${input.mode}'.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } else {
    sessionId = await createCopilotSession(storeId, input.mode);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { type: string; data: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send({ type: 'session', data: { sessionId, mode: input.mode } });

      try {
        for await (const event of runCopilotTurn(
          storeId,
          sessionId!,
          input.mode,
          input.message,
          { autoPushConfirmed: input.autoPushConfirmed },
        )) {
          send(event as CopilotStreamEvent);
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
