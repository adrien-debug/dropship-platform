'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function GenerateAdsButton({
  storeId,
  productId,
  hasExisting,
}: {
  storeId: string;
  productId: string;
  hasExisting: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/agent/stores/${storeId}/products/${productId}/ads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: 'fr' }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur génération');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="bg-zinc-900 text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Génération…' : hasExisting ? 'Régénérer' : 'Générer les hooks'}
      </button>
      {error && <span className="text-kicker text-red-600 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}
