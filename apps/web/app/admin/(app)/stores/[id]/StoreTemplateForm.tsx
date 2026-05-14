'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATE_CATALOG, type StoreTemplate } from '@/lib/template-catalog';

const OPTIONS = TEMPLATE_CATALOG.map((t) => ({
  value: t.id,
  label: t.label,
  hint: t.hint,
}));

type Template = StoreTemplate;

export function StoreTemplateForm({
  storeId,
  storeSlug,
  initial,
}: {
  storeId: string;
  storeSlug: string;
  initial: Template;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<Template>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== initial;

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: value }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  };

  return (
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 pt-4 pb-3 border-b border-zinc-200/70">
        <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Storefront</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">
          Template <em className="italic text-zinc-400">de rendu</em>
        </h3>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
          Choix du layout servi sur <code className="font-mono text-zinc-600">/shop/{storeSlug}</code>. Auto suit la
          règle historique. Bascule sur éditorial pour les niches narratives (3 à 6 produits liés par un univers).
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue(opt.value)}
                disabled={pending}
                className={`relative text-left p-4 rounded-lg border transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-blue-50 bg-white text-zinc-500'
                }`}
              >
                <div className="text-sm font-semibold mb-0.5">{opt.label}</div>
                <div className={`text-xs leading-snug ${active ? 'text-white/70' : 'text-zinc-400'}`}>
                  {opt.hint}
                </div>
                {active && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && !dirty && (
            <span className="text-xs text-blue-600">Enregistré.</span>
          )}
          {error && <span className="text-xs text-zinc-500">{error}</span>}
        </div>
      </div>
    </section>
  );
}
