import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from './app-shell';

export const metadata: Metadata = {
  title: 'Dropship Platform — Admin',
  description: 'Multi-site dropshipping management dashboard',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
