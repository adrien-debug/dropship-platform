'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-fetch';

/**
 * One-click luxury upgrade — re-renders the store's visuals through fal.ai
 * with editorial prompts, regenerates the copy in luxury brand voice, and
 * flips the template to `luxury-mono`. Single network call, takes 60-120s.
 */
export function LuxuryUpgradeButton({
  storeId,
  currentTemplate,
}: {
  storeId: string;
  currentTemplate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isLuxury = currentTemplate === 'luxury-mono';

  const run = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}/luxury-upgrade`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Échec du pipeline');
        const price = data.result?.suggestedPriceEuros;
        setSuccess(
          price
            ? `Boutique transformée. Prix suggéré : ${price} €.`
            : 'Boutique transformée. Visuels, copy et template à jour.',
        );
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inattendue');
        setConfirming(false);
      }
    });
  };

  return (
    <section className="border border-amber-200 bg-gradient-to-br from-amber-50 to-stone-50 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 pt-4 pb-3 border-b border-amber-100/70">
        <p className="text-kicker uppercase tracking-label text-amber-700 font-medium">
          Passage en mode luxe
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-stone-900">
          Upgrade éditorial <em className="italic text-stone-500">de toute la boutique</em>
        </h3>
        <p className="mt-1.5 text-xs text-stone-600 max-w-2xl leading-relaxed">
          Re-rend hero, cutout, lifestyle (×3) et packaging via fal.ai en composition
          studio luxe. Réécrit la copy en voix maison (Hermès / Aesop / Le Labo). Bascule
          le template sur <code className="font-mono text-stone-700">luxury-mono</code>{' '}
          et propose un prix de vente à 15-20× le coût fournisseur.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <ul className="text-xs text-stone-600 space-y-1.5 leading-relaxed">
          <li>· 6 visuels régénérés (≈ 60s) + 1 vidéo hero 5s (≈ 60s)</li>
          <li>· Copy littéraire FR (hero, story, atelier, packaging, CTA)</li>
          <li>· Template basculé sur <strong>luxury-mono</strong> automatiquement</li>
          <li>· Coût indicatif : ≈ 0,55 € par run (fal + Claude Opus)</li>
        </ul>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="inline-flex items-center gap-2 bg-stone-900 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-white text-stone-900 inline-flex items-center justify-center text-xs">
              →
            </span>
            {isLuxury ? 'Re-générer en mode luxe' : 'Passer en mode luxe'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="bg-stone-900 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Pipeline en cours… (60-120s)' : 'Confirmer le lancement'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-sm text-stone-500 hover:text-stone-700 px-3 py-2"
            >
              Annuler
            </button>
          </div>
        )}

        {success && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            {success}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
