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
    <section className="ct-card overflow-hidden" style={{ margin: 0 }}>
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--ct-border)' }}>
        <p className="text-kicker uppercase tracking-label font-medium" style={{ color: 'var(--ct-text-muted)' }}>Storefront</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight" style={{ color: 'var(--ct-text-primary)' }}>
          Template <em className="italic" style={{ color: 'var(--ct-text-muted)' }}>de rendu</em>
        </h3>
        <p className="mt-1.5 text-xs max-w-2xl" style={{ color: 'var(--ct-text-muted)' }}>
          Choix du layout servi sur <code className="font-mono" style={{ color: 'var(--ct-text-body)' }}>/shop/{storeSlug}</code>. Auto suit la
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
                className={`ct-seg-btn relative text-left p-4${active ? ' active' : ''}`}
                style={active ? undefined : { minHeight: 'auto' }}
              >
                <div className="text-sm font-semibold mb-0.5">{opt.label}</div>
                <div className={`text-xs leading-snug`} style={{ color: active ? 'inherit' : 'var(--ct-text-muted)', opacity: active ? 0.8 : 1 }}>
                  {opt.hint}
                </div>
                {active && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: 'var(--ct-text-strong)' }} aria-hidden />
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
            className="ct-seg-btn primary text-sm font-medium px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && !dirty && (
            <span className="text-xs" style={{ color: 'var(--ct-accent)' }}>Enregistré.</span>
          )}
          {error && <span className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>{error}</span>}
        </div>
      </div>
    </section>
  );
}
