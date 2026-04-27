import Link from 'next/link';
import { StoreShell } from '@/app/_components/StoreShell';

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StoreShell>
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Merci pour votre commande</h1>
        <p className="mt-3 text-zinc-600">Référence : <code className="bg-zinc-100 px-2 py-1 rounded text-sm">{id}</code></p>
        <p className="mt-2 text-zinc-600">Un email de confirmation vous sera envoyé.</p>
        <Link href="/products" className="mt-8 inline-block underline">Continuer mes achats</Link>
      </section>
    </StoreShell>
  );
}
