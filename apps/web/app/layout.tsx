import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

/**
 * Typography stack — set once, used everywhere. Fraunces (variable serif)
 * for editorial display headings, Inter for body. Self-hosted via next/font
 * so there's zero CLS and no external network call.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT'],
});

const inter = Inter({
  subsets: ['latin'],
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
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased bg-white text-zinc-900 font-sans">
        {children}
      </body>
    </html>
  );
}
