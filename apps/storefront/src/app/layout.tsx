import type { Metadata } from 'next';
import { CartProvider } from '@/context/cart-context';
import { OnePieceHeader } from '@/components/one-piece-header';
import { OnePieceFooter } from '@/components/one-piece-footer';
import { Analytics } from '@/components/analytics/Analytics';
import './globals.css';

const GA_ID = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];
const META_PIXEL_ID = process.env['NEXT_PUBLIC_META_PIXEL_ID'];

export const metadata: Metadata = {
  title: 'One Piece Store — Boutique Officielle',
  description: 'Figurines, T-shirts, Mugs et goodies One Piece exclusifs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">
        <Analytics gaId={GA_ID} metaPixelId={META_PIXEL_ID} />
        <CartProvider>
          <OnePieceHeader />
          <main className="min-h-[60vh]">{children}</main>
          <OnePieceFooter />
        </CartProvider>
      </body>
    </html>
  );
}
