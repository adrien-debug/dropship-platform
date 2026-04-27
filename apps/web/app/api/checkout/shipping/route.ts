import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCartId } from '@/lib/cart-cookie';
import { setShippingMethod } from '@/lib/medusa-store';
import { enforceRateLimit } from '@/lib/rate-limit';

const schema = z.object({ optionId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-shipping', { max: 20, windowSec: 60 });
    if (limited) return limited;
    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });
    const { optionId } = schema.parse(await request.json());
    await setShippingMethod(cartId, optionId);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Invalid params' }, { status: 400 });
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
