import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardOrder } from '@/lib/agent/order-forwarder';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({
  dryRun: z.boolean().optional().default(true),
  /** Required when dryRun=false. Forces the caller to acknowledge it'll place a real AE order. */
  confirm: z.literal('PLACE_REAL_ORDER').optional(),
  provinceOverride: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { dryRun: boolean; confirm?: string; provinceOverride?: string };
  try {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    body = schema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid input' },
      { status: 400 },
    );
  }

  // Cap live-forward attempts globally — the AE order_create is the most
  // expensive thing an authenticated session can trigger by accident.
  // Dry-runs are cheap enough that we don't bother.
  if (!body.dryRun) {
    const rl = await checkRateLimit('forward-live:global', { max: 10, windowSec: 60 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Live forwarding rate-limited. Retry in ${rl.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
  }

  if (!body.dryRun && body.confirm !== 'PLACE_REAL_ORDER') {
    return NextResponse.json(
      {
        error:
          'Live forwarding requires confirm: "PLACE_REAL_ORDER" in the body. This call would place a real, paid AliExpress order.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await forwardOrder(id, {
      dryRun: body.dryRun,
      provinceOverride: body.provinceOverride,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
