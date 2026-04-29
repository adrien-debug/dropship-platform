'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  async function call() {
    const ok = window.confirm(
      'Confirme que tu as bien payé cette commande sur aliexpress.com.\n\n' +
        'Cette action ne paie rien — elle sert juste à sortir la commande de la liste « à payer ».',
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent/orders/${orderId}/mark-paid`, { method: 'POST' });
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
        onClick={call}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded-md border border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? '…' : 'Marquer payée'}
      </button>
      {error && <span className="text-kicker text-red-600 max-w-[200px] text-right">{error}</span>}
    </div>
  );
}
