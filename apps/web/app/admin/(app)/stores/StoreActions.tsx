'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@/app/admin/_components/AdminUI';
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
        className={`inline-flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls}`}
        style={{
          background: 'var(--ct-surface-1)',
          borderColor: error ? 'var(--ct-border-accent)' : 'var(--ct-border)',
          color: error ? 'var(--ct-accent-strong)' : 'var(--ct-text-muted)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--ct-surface-2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--ct-surface-1)';
        }}
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
