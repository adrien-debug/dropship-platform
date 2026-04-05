'use client';

import { useCart } from '@/context/cart-context';
import Link from 'next/link';
import { useEffect } from 'react';

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center font-['Noto_Sans_JP',sans-serif]">
      <div className="mb-6 text-5xl">🎉</div>
      <h1 className="mb-4 text-2xl font-bold text-[#333]">Merci pour votre commande !</h1>
      <p className="mb-2 text-[#666]">
        Votre paiement a été confirmé. Vous recevrez un e-mail de confirmation sous peu.
      </p>
      <p className="mb-8 text-sm text-[#999]">
        Livraison estimée : 7 à 15 jours ouvrés.
      </p>
      <Link
        href="/shop"
        className="inline-block rounded-full bg-[#D9312B] px-8 py-3 font-bold text-white hover:bg-[#c62828] transition-colors"
      >
        Continuer mes achats
      </Link>
    </main>
  );
}
