import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createStore } from '@/lib/agent/store-creator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  niche: z.string().min(2).max(100),
  storeName: z.string().min(2).max(80),
  maxProducts: z.number().int().min(3).max(25).optional().default(12),
  language: z.enum(['fr', 'en']).optional().default('fr'),
});

export async function POST(req: NextRequest) {
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
        for await (const event of createStore(input)) {
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
