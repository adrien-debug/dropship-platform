'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
interface Props {
  orderId: string;
  alreadySent: boolean;
}

interface ForwardResponse {
  ok: boolean;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;
  aeOrderId?: string;
  error?: string;
  unmappedItems?: { itemId: string; title: string; reason: string }[];
  payload?: unknown;
}

export function ForwardButton({ orderId, alreadySent }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'dry' | 'live' | null>(null);
  const [result, setResult] = useState<ForwardResponse | null>(null);
  const [confirmLiveOpen, setConfirmLiveOpen] = useState(false);

  async function call(dryRun: boolean) {
    setBusy(dryRun ? 'dry' : 'live');
    setResult(null);
    try {
      const res = await apiFetch(`/api/agent/orders/${orderId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          ...(dryRun ? {} : { confirm: 'PLACE_REAL_ORDER' }),
        }),
      });
      const data = (await res.json()) as ForwardResponse;
      setResult(data);
      if (data.ok) router.refresh();
    } catch (e) {
      setResult({
        ok: false,
        status: 'error',
        forwardId: '',
        error: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          onClick={() => call(true)}
          disabled={busy !== null}
          className="px-3 py-1.5 text-xs rounded-md border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Sauve le payload AE sans rien envoyer"
        >
          {busy === 'dry' ? '…' : 'Dry-run'}
        </button>
        <button
          onClick={() => setConfirmLiveOpen(true)}
          disabled={busy !== null || alreadySent}
          className="px-3 py-1.5 text-xs rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
          title={alreadySent ? 'Déjà envoyée à AliExpress' : 'Place une vraie commande AE'}
        >
          {busy === 'live' ? '…' : alreadySent ? 'Envoyée' : 'Envoyer à AE'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmLiveOpen}
        title="Passer une vraie commande AliExpress ?"
        description={`AE crée la commande en statut « En attente de paiement ». Tu devras ensuite te connecter sur aliexpress.com pour la payer.\n\nCette action est irréversible.`}
        confirmLabel="Envoyer à AE"
        tone="destructive"
        onConfirm={() => {
          setConfirmLiveOpen(false);
          call(false);
        }}
        onCancel={() => setConfirmLiveOpen(false)}
      />

      {result && (
        <div
          className={`text-[11px] rounded-md px-2.5 py-1.5 border max-w-[280px] ${
            result.ok
              ? result.status === 'sent'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-indigo-50 border-indigo-200 text-indigo-600'
              : 'bg-zinc-50 border-zinc-200 text-zinc-500'
          }`}
        >
          <div className="font-medium">
            {result.status === 'sent' && `Envoyée — AE #${result.aeOrderId}`}
            {result.status === 'dry_run' && 'Dry-run OK · payload sauvegardé'}
            {result.status === 'error' && (result.error ?? 'Erreur inconnue')}
          </div>
          {result.unmappedItems && result.unmappedItems.length > 0 && (
            <div className="mt-1 opacity-75 text-kicker">
              {result.unmappedItems.length} item(s) non mappé(s) : {result.unmappedItems.map((u) => u.title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
