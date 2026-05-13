/**
 * TikTok Developer Portal expects either a meta tag in <head> OR this
 * plain-text file at /.well-known/tiktok-developers-site-verification.txt
 * containing the verification token. We support both so whichever check
 * the portal runs against the domain passes.
 *
 * Set NEXT_PUBLIC_TIKTOK_SITE_VERIFICATION in the Vercel env after copying
 * the token from "Verify URL properties" in the TikTok app submission form.
 */

export const dynamic = 'force-static';
export const revalidate = 3600;

export function GET() {
  const token = process.env.NEXT_PUBLIC_TIKTOK_SITE_VERIFICATION ?? '';
  return new Response(token, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
