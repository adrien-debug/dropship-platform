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
        className="px-4 py-2 text-xs rounded-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--ct-surface-3)',
          color: 'var(--ct-text-primary)',
          border: '1px solid var(--ct-border-strong)',
          transition: 'opacity var(--ct-dur-base) var(--ct-ease)',
        }}
      >
        {busy ? 'Pré-calcul…' : 'Pré-calculer les dry-runs'}
      </button>
      {result && (
        <span className="text-[10px]" style={{ color: 'var(--ct-text-muted)' }}>
          {result.processed} traitée{result.processed > 1 ? 's' : ''} sur {result.scanned} payée{result.scanned > 1 ? 's' : ''}
        </span>
      )}
      {error && (
        <span className="text-[10px]" style={{ color: 'var(--ct-text-muted)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
