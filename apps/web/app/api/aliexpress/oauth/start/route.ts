import { NextResponse } from 'next/server';

const APP_KEY = (process.env.ALIEXPRESS_APP_KEY || '').trim();

export async function GET() {
  if (!APP_KEY) {
    return NextResponse.json({ error: 'ALIEXPRESS_APP_KEY not configured' }, { status: 500 });
  }

  // Le redirect_uri doit matcher EXACTEMENT le Callback URL de la console AliExpress.
  // VERCEL_URL est l'URL du déploiement (preview), pas l'alias prod — on hardcode la prod.
  const redirectUri = 'https://dropship-platform-amber.vercel.app/api/aliexpress/oauth/callback';

  // Doc officielle Alibaba (treeId=727 articleId=120687) :
  // https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${cb}&client_id=${appkey}
  const oauthUrl = new URL('https://api-sg.aliexpress.com/oauth/authorize');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('force_auth', 'true');
  oauthUrl.searchParams.set('client_id', APP_KEY);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);

  return NextResponse.redirect(oauthUrl.toString());
}
