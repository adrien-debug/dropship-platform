/**
 * GET  /api/agent/stores/:id/assets        → run history, grouped by asset_kind
 * POST /api/agent/stores/:id/assets        → { runId, kind } "set as current"
 *
 * Powers the history strip + rollback in the admin assets page. Auth is
 * handled by middleware on /api/agent/*. Read-side uses the regenerator's
 * grouper; write-side delegates to {@link setRunAsCurrent}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveStoreId } from '@/lib/resolve-store';
import {
  ASSET_KINDS,
  listRunsForStore,
  setRunAsCurrent,
  type AssetKind,
} from '@/lib/agent/asset-regenerator';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ ok: false, error: 'Store not found' }, { status: 404 });
  try {
    const runs = await listRunsForStore(storeId, 10);
    return NextResponse.json({ ok: true, runs });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    );
  }
}

const setCurrentSchema = z.object({
  runId: z.string().uuid(),
  kind: z.enum(ASSET_KINDS as unknown as [AssetKind, ...AssetKind[]]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ ok: false, error: 'Store not found' }, { status: 404 });
  try {
    const body = setCurrentSchema.parse(await req.json());
    const { url } = await setRunAsCurrent({
      storeId,
      runId: body.runId,
      kind: body.kind,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid params', details: e.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    );
  }
}
