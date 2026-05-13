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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const runDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    await fetch(`${base}/api/agent/stores/${storeId}`, { method: 'DELETE' });
    router.refresh();
  };

  const sizeCls = compact ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        aria-label={`Supprimer ${storeName}`}
        title={`Supprimer ${storeName}`}
        className={`inline-flex items-center justify-center rounded-lg border bg-white border-zinc-200 text-zinc-400 hover:bg-indigo-50 hover:text-zinc-900 hover:border-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls}`}
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
