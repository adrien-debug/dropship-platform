import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    config: {
      aliexpress: {
        configured: !!process.env.ALIEXPRESS_APP_KEY,
        message: process.env.ALIEXPRESS_APP_KEY ? 'Configured' : 'Missing ALIEXPRESS_APP_KEY',
      },
      cjdropshipping: {
        configured: !!(process.env.CJ_DROPSHIPPING_EMAIL && process.env.CJ_DROPSHIPPING_API_KEY),
        message: (process.env.CJ_DROPSHIPPING_EMAIL && process.env.CJ_DROPSHIPPING_API_KEY) 
          ? 'Configured' 
          : 'Missing CJ credentials',
      },
    },
    env: {
      hasAliKey: !!process.env.ALIEXPRESS_APP_KEY,
      hasCjEmail: !!process.env.CJ_DROPSHIPPING_EMAIL,
    },
  });
}
