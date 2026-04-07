import { NextResponse, type NextRequest } from 'next/server';

interface PromoCode {
  type: 'percent' | 'shipping';
  percent?: number;
  freeShipping: boolean;
}

const PROMO_CODES: Record<string, PromoCode> = {
  ONEPIECE10: { type: 'percent', percent: 10, freeShipping: false },
  NAKAMA20:   { type: 'percent', percent: 20, freeShipping: false },
  FREESHIP:   { type: 'shipping', freeShipping: true },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = (body.code ?? '').toString().trim().toUpperCase();
    const subtotalCents = Number(body.subtotalCents ?? 0);

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Code is required' }, { status: 400 });
    }

    const promo = PROMO_CODES[code];
    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Invalid promo code' });
    }

    let discountCents = 0;
    if (promo.type === 'percent' && promo.percent) {
      discountCents = Math.round(subtotalCents * (promo.percent / 100));
    }

    return NextResponse.json({
      valid: true,
      discountCents,
      finalCents: Math.max(0, subtotalCents - discountCents),
      freeShipping: promo.freeShipping,
    });
  } catch (error) {
    console.error('[discounts/validate] Error:', error);
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 });
  }
}
