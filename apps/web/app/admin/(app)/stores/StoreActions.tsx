'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StoreActions({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Supprimer le store "${storeName}" et tous ses produits Medusa ?`)) return;
    setDeleting(true);
    await fetch(`/api/agent/stores/${storeId}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {deleting ? '...' : '🗑'}
    </button>
  );
}
