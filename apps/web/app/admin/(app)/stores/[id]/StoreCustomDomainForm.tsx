'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
export function StoreCustomDomainForm({
  storeId,
  initial,
}: {
  storeId: string;
  initial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== initial.trim();
  useUnsavedChanges(dirty && !pending);

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customDomain: value.trim() }),
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
        <p className="text-kicker uppercase tracking-label font-medium" style={{ color: 'var(--ct-text-muted)' }}>Domaine</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight" style={{ color: 'var(--ct-text-primary)' }}>
          Domaine <em className="italic" style={{ color: 'var(--ct-text-muted)' }}>personnalisé</em>
        </h3>
        <p className="mt-1.5 text-xs max-w-2xl" style={{ color: 'var(--ct-text-muted)' }}>
          Saisir le domaine apex (ex.{' '}
          <code className="font-mono" style={{ color: 'var(--ct-text-body)' }}>maison-chic.com</code>). Les visites sur ce
          domaine seront servies en tant que{' '}
          <code className="font-mono" style={{ color: 'var(--ct-text-body)' }}>/shop/{'{slug}'}</code> sans redirection.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="custom-domain" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ct-text-body)' }}>
            Domaine
          </label>
          <input
            id="custom-domain"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="maison-chic.com"
            disabled={pending}
            className="w-full sm:w-80 rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
            style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)', color: 'var(--ct-text-primary)' }}
          />
        </div>

        <div className="text-xs rounded-lg p-3 space-y-1 max-w-lg" style={{ background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}>
          <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Configuration DNS requise</p>
          <p>
            Pointer votre DNS A/CNAME vers{' '}
            <code className="font-mono" style={{ color: 'var(--ct-text-body)' }}>cname.vercel-dns.com</code>, puis ajouter le
            domaine dans <strong>Vercel &rarr; Domains</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="ct-seg-btn primary text-sm font-medium px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {dirty && !pending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Non sauvegardé
            </span>
          )}
          {saved && !dirty && (
            <span className="text-xs" style={{ color: 'var(--ct-accent)' }}>Enregistré.</span>
          )}
          {error && <span className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>{error}</span>}
        </div>
      </div>
    </section>
  );
}
