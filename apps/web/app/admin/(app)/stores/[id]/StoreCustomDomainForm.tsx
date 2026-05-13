'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 pt-4 pb-3 border-b border-zinc-200/70">
        <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Domaine</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">
          Domaine <em className="italic text-zinc-400">personnalisé</em>
        </h3>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
          Saisir le domaine apex (ex.{' '}
          <code className="font-mono text-zinc-600">maison-chic.com</code>). Les visites sur ce
          domaine seront servies en tant que{' '}
          <code className="font-mono text-zinc-600">/shop/{'{slug}'}</code> sans redirection.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="custom-domain" className="block text-xs font-medium text-zinc-500 mb-1.5">
            Domaine
          </label>
          <input
            id="custom-domain"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="maison-chic.com"
            disabled={pending}
            className="w-full sm:w-80 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div className="text-xs text-zinc-500 bg-zinc-100 rounded-lg p-3 space-y-1 max-w-lg">
          <p className="font-medium text-zinc-900">Configuration DNS requise</p>
          <p>
            Pointer votre DNS A/CNAME vers{' '}
            <code className="font-mono text-zinc-500">cname.vercel-dns.com</code>, puis ajouter le
            domaine dans <strong>Vercel &rarr; Domains</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && !dirty && (
            <span className="text-xs text-indigo-600">Enregistré.</span>
          )}
          {error && <span className="text-xs text-zinc-500">{error}</span>}
        </div>
      </div>
    </section>
  );
}
