'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconButton, TrashIcon } from '../../_components/AdminUI';

export function StoreActions({ storeId, storeName }: { storeId: string; storeName: string }) {
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

  return (
    <IconButton
      label={`Supprimer ${storeName}`}
      onClick={handleDelete}
      disabled={deleting}
      tone="danger"
    >
      <TrashIcon size={15} />
    </IconButton>
  );
}
