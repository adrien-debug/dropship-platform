import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hearst — Lancez votre boutique en 60 secondes',
  description:
    "L'agent IA qui crée, optimise et gère votre boutique dropshipping de A à Z. Produits, textes, domaine — tout est automatisé.",
  openGraph: {
    title: 'Hearst — Lancez votre boutique en 60 secondes',
    description:
      "L'agent IA qui crée, optimise et gère votre boutique dropshipping de A à Z.",
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
