import { NextResponse } from 'next/server';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();

export async function GET() {
  if (!APP_KEY) {
    return NextResponse.json({ error: 'ALIEXPRESS_APP_KEY not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || 'http://localhost:3000';

  const redirectUri = `${baseUrl}/api/aliexpress/oauth/callback`;

  const oauthUrl = new URL('https://oauth.aliexpress.com/authorize');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('client_id', APP_KEY);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('view', 'web');
  oauthUrl.searchParams.set('sp', 'ae');

  return NextResponse.redirect(oauthUrl.toString());
}
