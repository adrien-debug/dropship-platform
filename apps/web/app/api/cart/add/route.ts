import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addToCart } from '@/lib/store-cart';
import { enforceRateLimit } from '@/lib/rate-limit';

const schema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().min(1).max(99),
  // Slug of the /shop/[slug] storefront the user is currently on. Lets the
  // cart be created against that store's sales_channel and switched out if
  // the previous cart belongs to a different store.
  slug: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, 'cart-add', { max: 30, windowSec: 60 });
    if (limited) return limited;
    const body = await request.json();
    const { variantId, quantity, slug } = schema.parse(body);
    const cart = await addToCart(variantId, quantity, slug);
    return NextResponse.json({ success: true, cartId: cart.id, items: cart.items.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid params', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
