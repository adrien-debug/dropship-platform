'use client';

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
      const res = await fetch('/api/agent/orders/dry-run-pending', { method: 'POST' });
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
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="px-4 py-2 text-sm rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Pré-calcul…' : 'Pré-calculer les dry-runs des nouvelles commandes'}
      </button>
      {result && (
        <span className="text-xs text-zinc-500">
          {result.processed} traitée(s) sur {result.scanned} payée(s)
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
