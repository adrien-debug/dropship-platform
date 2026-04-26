import { NextResponse } from 'next/server';
import { getMedusaBaseUrl } from '@/lib/medusa';

export async function GET() {
  try {
    const medusaUrl = getMedusaBaseUrl();
    if (!medusaUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'MEDUSA_URL non défini (requis hors environnement next dev)',
        },
        { status: 503 },
      );
    }

    const response = await fetch(`${medusaUrl}/health`, { method: 'GET' });
    const text = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      health: text.slice(0, 200),
    });
  } catch (error) {
    console.error('[Medusa health] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
