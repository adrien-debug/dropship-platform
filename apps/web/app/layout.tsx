import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import '@hearst/cockpit-shell/tokens.css';
import AppFrame from '@/app/_components/AppFrame';

/**
 * Typography stack — Satoshi Variable everywhere. Self-hosted via next/font
 * so there's zero CLS and no external network call. The variable axis spans
 * weights 300–900; we drive the hierarchy through weight + size, not via a
 * separate display font.
 */
const satoshi = localFont({
  src: [
    {
      path: '../public/fonts/Satoshi-Variable.woff2',
      weight: '300 900',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi-VariableItalic.woff2',
      weight: '300 900',
      style: 'italic',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dropship Platform',
  description: 'Dropship admin & integrations',
  // Google Search Console / Merchant Center site verification.
  // Token issued in Merchant Center > Add an HTML tag. Rotation = update
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION env var, redeploy.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // TikTok Developer Portal domain verification. They issue a token when
  // you click "Verify URL properties" on the app submission form; we
  // surface it as a <meta> in the document head. Set
  // NEXT_PUBLIC_TIKTOK_SITE_VERIFICATION in the Vercel env after copying
  // the value from TikTok, redeploy, then click Verify in the portal.
  const tiktokVerif = process.env.NEXT_PUBLIC_TIKTOK_SITE_VERIFICATION;
  return (
    <html lang="fr" className={satoshi.variable}>
      <head>
        {tiktokVerif && (
          <meta name="tiktok-developers-site-verification" content={tiktokVerif} />
        )}
      </head>
      <body className="min-h-screen antialiased font-sans">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
