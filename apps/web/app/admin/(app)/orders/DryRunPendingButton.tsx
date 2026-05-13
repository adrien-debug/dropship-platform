'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
interface BatchResult {
  scanned: number;
  processed: number;
  results: { medusaOrderId: string; status: string; ok: boolean; error?: string }[];
}

export function DryRunPendingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiFetch('/api/agent/orders/dry-run-pending', { method: 'POST' });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as BatchResult;
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={run}
        disabled={busy}
        className="px-4 py-2 text-xs rounded-lg border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider"
      >
        {busy ? 'Pré-calcul…' : 'Pré-calculer les dry-runs'}
      </button>
      {result && (
        <span className="text-kicker text-zinc-500">
          {result.processed} traitée{result.processed > 1 ? 's' : ''} sur {result.scanned} payée{result.scanned > 1 ? 's' : ''}
        </span>
      )}
      {error && <span className="text-kicker text-red-600">{error}</span>}
    </div>
  );
}
