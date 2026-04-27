import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCartId } from '@/lib/cart-cookie';
import { updateCart } from '@/lib/medusa-store';

const schema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  address_1: z.string().min(1),
  city: z.string().min(1),
  postal_code: z.string().min(1),
  // Required for AliExpress dropship orders (ds.order.create rejects without it).
  province: z.string().min(1),
  country_code: z.string().length(2),
  phone: z.string().min(5),
});

export async function POST(request: NextRequest) {
  try {
    const cartId = await getCartId();
    if (!cartId) return NextResponse.json({ success: false, error: 'No cart' }, { status: 400 });
    const body = schema.parse(await request.json());
    const { email, ...address } = body;
    await updateCart(cartId, {
      email,
      shipping_address: address,
      billing_address: address,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Champs invalides', details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
