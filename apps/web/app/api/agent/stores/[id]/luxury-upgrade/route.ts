/**
 * POST /api/agent/stores/:id/luxury-upgrade
 *
 * Triggers the luxury pipeline on an existing store. Re-renders all visuals
 * through fal.ai with editorial prompts, generates literary French copy via
 * Claude, persists everything, and flips the store's template to
 * `luxury-mono`.
 *
 * This is intentionally NOT streaming — the entire run takes ~60-120s and
 * the admin UI shows a single spinner. If we need granular progress later,
 * mirror the SSE pattern from `assets/regenerate/route.ts`.
 *
 * Auth: middleware enforces admin Basic auth on /api/agent/*.
 * maxDuration: 300s to cover the video step which is the slowest leg.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveStoreId } from '@/lib/resolve-store';
import { runLuxuryUpgrade } from '@/lib/agent/luxury-pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });

  try {
    const result = await runLuxuryUpgrade(storeId);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`luxury-upgrade ${storeId} failed:`, message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
