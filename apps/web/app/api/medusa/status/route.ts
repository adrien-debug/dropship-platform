import { NextResponse } from 'next/server';
import { medusa } from '@/lib/medusa';

/**
 * GET /api/medusa/status
 * Santé + auth admin (sans exposer secrets ni token).
 */
export async function GET() {
  try {
    const cfg = medusa.checkConfig();
    const probe = await medusa.verifyAdminConnection();

    return NextResponse.json({
      success: true,
      config: {
        ok: cfg.ok && probe.authOk,
        message: probe.authOk ? cfg.message : probe.message,
      },
      healthOk: probe.healthOk,
      authMode: probe.authMode,
      authOk: probe.authOk,
      detail: probe.message,
    });
  } catch (error) {
    console.error('[Medusa status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        config: { ok: false, message: error instanceof Error ? error.message : 'Unknown error' },
        healthOk: false,
        authOk: false,
      },
      { status: 500 },
    );
  }
}
