import { NextRequest } from 'next/server';
import { z } from 'zod';
import { runSuperAgentTurn, createSuperAgentSession } from '@/lib/agent/super-agent';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  message: z.string().min(1).max(8000),
  page: z.string().optional().default(''),
  storeId: z.string().uuid().optional(),
  /**
   * Resume an existing session. When absent, the route creates a fresh
   * dropship_copilot_sessions row (mode='super') and emits its id on the
   * stream so the client can store it for the next turn.
   */
  sessionId: z.string().uuid().optional(),
  confirmations: z.record(z.boolean()).optional().default({}),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'super-agent', { max: 60, windowSec: 60 });
  if (limited) return limited;

  let input;
  try {
    const body = await req.json();
    input = schema.parse(body);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid input' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Resolve / create the session up-front so the first SSE event surfaces
  // the id back to the client. Failure here is non-fatal — the agent still
  // runs without persistence, which is the right behavior when migration 029
  // has not been applied yet (the CHECK constraint refuses mode='super').
  // We surface the error to console + as a soft 'error' event below so the
  // operator sees the cause in the panel.
  let sessionId: string | undefined = input.sessionId;
  let sessionCreateError: string | null = null;
  if (!sessionId) {
    try {
      sessionId = await createSuperAgentSession(input.storeId ?? null);
    } catch (err) {
      sessionCreateError = err instanceof Error ? err.message : 'Session create failed';
      console.error('[super-agent] createSession failed', err);
      sessionId = undefined;
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Always tell the client which session id this turn writes to (or
      // empty string when persistence is degraded).
      send({ type: 'session', sessionId: sessionId ?? '' });

      // Surface the persistence failure (typically: migration 029 not yet
      // applied) so the operator sees it in the panel instead of silently
      // losing their history. The agent itself still runs.
      if (sessionCreateError) {
        send({
          type: 'error',
          message: `Historique désactivé : ${sessionCreateError}. Pour l'activer, applique infra/postgres/029_super_agent_messages.sql (par exemple via run_sql write).`,
        });
      }

      try {
        for await (const event of runSuperAgentTurn(input.message, {
          page: input.page,
          storeId: input.storeId,
          sessionId,
          confirmations: input.confirmations,
        })) {
          send(event);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Erreur serveur' });
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
