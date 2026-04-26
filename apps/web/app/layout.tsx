import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dropship Platform',
  description: 'Dropship admin & integrations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased bg-white text-zinc-900">{children}</body>
    </html>
  );
}
