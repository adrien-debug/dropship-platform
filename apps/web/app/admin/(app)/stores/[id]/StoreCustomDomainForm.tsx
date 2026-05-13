'use client';

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
        const res = await fetch(`/api/agent/stores/${storeId}`, {
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
    <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-zinc-200/70">
        <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Domaine</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">
          Domaine <em className="italic text-zinc-500">personnalisé</em>
        </h3>
        <p className="mt-1.5 text-xs text-zinc-500 max-w-2xl">
          Saisir le domaine apex (ex.{' '}
          <code className="font-mono text-zinc-700">maison-chic.com</code>). Les visites sur ce
          domaine seront servies en tant que{' '}
          <code className="font-mono text-zinc-700">/shop/{'{slug}'}</code> sans redirection.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="custom-domain" className="block text-xs font-medium text-zinc-700 mb-1.5">
            Domaine
          </label>
          <input
            id="custom-domain"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="maison-chic.com"
            disabled={pending}
            className="w-full sm:w-80 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:opacity-50"
          />
        </div>

        <div className="text-xs text-zinc-500 bg-zinc-50 rounded-lg p-3 space-y-1 max-w-lg">
          <p className="font-medium text-zinc-700">Configuration DNS requise</p>
          <p>
            Pointer votre DNS A/CNAME vers{' '}
            <code className="font-mono text-zinc-600">cname.vercel-dns.com</code>, puis ajouter le
            domaine dans <strong>Vercel &rarr; Domains</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || pending}
            className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved && !dirty && (
            <span className="text-xs text-emerald-700">Enregistre.</span>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </section>
  );
}
