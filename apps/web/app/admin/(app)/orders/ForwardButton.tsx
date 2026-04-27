'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  async function call(dryRun: boolean) {
    if (!dryRun) {
      const ok = window.confirm(
        'Cette action passe une VRAIE commande chez AliExpress, qui sera débitée sur ton compte AE.\n\nContinuer ?',
      );
      if (!ok) return;
    }
    setBusy(dryRun ? 'dry' : 'live');
    setResult(null);
    try {
      const res = await fetch(`/api/agent/orders/${orderId}/forward`, {
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => call(true)}
          disabled={busy !== null}
          className="px-3 py-1.5 text-xs rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {busy === 'dry' ? '…' : 'Dry-run'}
        </button>
        <button
          onClick={() => call(false)}
          disabled={busy !== null || alreadySent}
          className="px-3 py-1.5 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={alreadySent ? 'Déjà envoyée à AliExpress' : 'Place une vraie commande AE'}
        >
          {busy === 'live' ? '…' : alreadySent ? 'Envoyée ✓' : 'Envoyer à AE'}
        </button>
      </div>

      {result && (
        <div
          className={`text-xs rounded-md p-2 border ${
            result.ok
              ? result.status === 'sent'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="font-medium">
            {result.status === 'sent' && `✅ Envoyée à AE — order #${result.aeOrderId}`}
            {result.status === 'dry_run' && '🧪 Dry-run OK — payload sauvegardée'}
            {result.status === 'error' && `❌ ${result.error}`}
          </div>
          {result.unmappedItems && result.unmappedItems.length > 0 && (
            <div className="mt-1 opacity-75">
              {result.unmappedItems.length} item(s) non mappé(s) :{' '}
              {result.unmappedItems.map((u) => u.title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
