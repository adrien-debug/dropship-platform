/**
 * POST /api/agent/stores/:id/assets/regenerate
 *
 * SSE endpoint streaming the progress of a single-asset regeneration. The
 * admin UI opens this stream when the user clicks "Lancer" in the regen
 * panel; events use the same `{ type, message, data }` shape as
 * `/api/agent/create-store` so we can share the log-line component.
 *
 * Auth is handled by middleware (admin Basic auth on `/api/agent/*`). The
 * `maxDuration` is bumped to 300s because the video workflow can take up to
 * 3 minutes on a busy GPU queue.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveStoreId } from '@/lib/resolve-store';
import { ASSET_KINDS, regenerateAsset, type AssetKind } from '@/lib/agent/asset-regenerator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  kind: z.enum(ASSET_KINDS as unknown as [AssetKind, ...AssetKind[]]),
  customPrompt: z.string().trim().max(2000).optional(),
  productImageUrl: z.string().url().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) {
    return new Response(
      JSON.stringify({ error: 'Store not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
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
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might already be closed (client disconnect).
        }
      };

      send({ type: 'step', message: `Régénération ${parsed.kind} démarrée.` });

      try {
        const result = await regenerateAsset(
          {
            storeId,
            kind: parsed.kind,
            customPrompt: parsed.customPrompt,
            productImageUrl: parsed.productImageUrl,
          },
          (msg) => send({ type: 'progress', message: msg }),
        );

        send({
          type: 'success',
          message: `Nouvel asset disponible.`,
          data: { url: result.url, runId: result.runId, kind: parsed.kind },
        });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Erreur serveur',
        });
      }

      send({ type: 'done', message: 'Stream terminé.' });
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
