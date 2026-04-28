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
