import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CONSENT_COOKIE } from '@/lib/consent-shared';

const schema = z.object({ choice: z.enum(['granted', 'denied']) });

const SIX_MONTHS_SECONDS = 60 * 60 * 24 * 180;

/**
 * POST /api/consent — visitor's RGPD choice. Sets a 1st-party cookie that
 * the storefront layout reads server-side to decide whether to inject
 * Meta / GA4 / TikTok / Clarity tags. Refusal is honoured for 6 months;
 * after that the banner re-prompts.
 */
export async function POST(request: NextRequest) {
  try {
    const { choice } = schema.parse(await request.json());
    const res = NextResponse.json({ success: true, choice });
    res.cookies.set(CONSENT_COOKIE, choice, {
      httpOnly: false, // Client-side banner needs to read it to know whether to hide.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SIX_MONTHS_SECONDS,
      path: '/',
    });
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid params' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Erreur' }, { status: 500 });
  }
}
