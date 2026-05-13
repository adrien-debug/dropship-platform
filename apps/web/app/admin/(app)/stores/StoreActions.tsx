'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '../../_components/AdminUI';

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
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Supprimer le store « ${storeName} » et tous ses produits Medusa ?`)) return;
    setDeleting(true);
    // Build the URL via window.location.origin so the request never inherits
    // basic-auth credentials embedded in the current URL — the Fetch spec
    // refuses to construct a Request from a URL that contains user:pass@.
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    await fetch(`${base}/api/agent/stores/${storeId}`, { method: 'DELETE' });
    router.refresh();
  };

  const sizeCls = compact ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      aria-label={`Supprimer ${storeName}`}
      title={`Supprimer ${storeName}`}
      className={`inline-flex items-center justify-center rounded-lg border bg-white border-zinc-200 text-zinc-400 hover:bg-indigo-50 hover:text-zinc-900 hover:border-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls}`}
    >
      <TrashIcon size={compact ? 13 : 15} />
    </button>
  );
}
