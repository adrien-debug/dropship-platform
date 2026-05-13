'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
interface Props {
  orderId: string;
}

/**
 * Manual "I paid this on aliexpress.com" flag. AE has no public API to detect
 * payment, so the merchant clicks this after going through the AE checkout.
 */
export function MarkPaidButton({ orderId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function run() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/agent/orders/${orderId}/mark-paid`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded-md border border-indigo-200 bg-white text-indigo-600 hover:border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? '…' : 'Marquer payée'}
      </button>
      {error && <span className="text-kicker text-zinc-500 max-w-[200px] text-right">{error}</span>}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmer le paiement"
        description={`Confirme que tu as bien payé cette commande sur aliexpress.com.\n\nCette action ne paie rien — elle sert juste à sortir la commande de la liste « à payer ».`}
        confirmLabel="J'ai payé"
        onConfirm={run}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
