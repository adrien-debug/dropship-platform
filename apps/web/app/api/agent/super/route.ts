import { NextRequest } from 'next/server';
import { z } from 'zod';
import { runSuperAgentTurn } from '@/lib/agent/super-agent';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  message: z.string().min(1).max(8000),
  page: z.string().optional().default(''),
  storeId: z.string().uuid().optional(),
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of runSuperAgentTurn(input.message, {
          page: input.page,
          storeId: input.storeId,
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
