'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '../../_components/AdminUI';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function StoreActions({
  storeId,
  storeName,
  compact = false,
}: {
  storeId: string;
  storeName: string;
  compact?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const runDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/agent/stores/${storeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const sizeCls = compact ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        aria-label={`Supprimer ${storeName}`}
        title={error || `Supprimer ${storeName}`}
        className={`inline-flex items-center justify-center rounded-lg border bg-white border-zinc-200 text-zinc-400 hover:bg-blue-50 hover:text-zinc-900 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${error ? 'border-red-200 text-red-500' : ''} ${sizeCls}`}
      >
        <TrashIcon size={compact ? 13 : 15} />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title={`Supprimer le store « ${storeName} » ?`}
        description="Cette action supprimera aussi tous ses produits Medusa. Elle est irréversible."
        confirmLabel="Supprimer"
        tone="destructive"
        onConfirm={runDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
