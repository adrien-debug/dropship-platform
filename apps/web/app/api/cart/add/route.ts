import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addToCart } from '@/lib/store-cart';

const schema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().min(1).max(99),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { variantId, quantity } = schema.parse(body);
    const cart = await addToCart(variantId, quantity);
    return NextResponse.json({ success: true, cartId: cart.id, items: cart.items.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid params', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
