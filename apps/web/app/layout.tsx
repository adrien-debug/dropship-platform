import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

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
  return (
    <html lang="fr" className={satoshi.variable}>
      <body className="min-h-screen antialiased bg-white text-zinc-900 font-sans">
        {children}
      </body>
    </html>
  );
}
