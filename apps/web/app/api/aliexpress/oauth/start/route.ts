import { NextResponse } from 'next/server';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();

export async function GET() {
  if (!APP_KEY) {
    return NextResponse.json({ error: 'ALIEXPRESS_APP_KEY not configured' }, { status: 500 });
  }

  // AliExpress rejette localhost — toujours utiliser l'URL de production
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://dropship-platform-amber.vercel.app';

  const redirectUri = `${baseUrl}/api/aliexpress/oauth/callback`;

  // Singapore endpoint for DS apps
  const oauthUrl = new URL('https://oauth-sg.aliexpress.com/authorize');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('client_id', APP_KEY);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('view', 'web');

  return NextResponse.redirect(oauthUrl.toString());
}
