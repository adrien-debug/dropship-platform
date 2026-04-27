import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setLineQuantity, removeLine } from '@/lib/store-cart';
import { enforceRateLimit } from '@/lib/rate-limit';

const updateSchema = z.object({
  lineItemId: z.string().min(1),
  quantity: z.number().min(0).max(99),
});

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, 'cart-update', { max: 60, windowSec: 60 });
    if (limited) return limited;
    const { lineItemId, quantity } = updateSchema.parse(await request.json());
    const cart = quantity === 0 ? await removeLine(lineItemId) : await setLineQuantity(lineItemId, quantity);
    return NextResponse.json({ success: true, items: cart?.items?.length ?? 0 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Invalid params' }, { status: 400 });
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
