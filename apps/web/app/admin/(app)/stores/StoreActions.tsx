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
    await fetch(`/api/agent/stores/${storeId}`, { method: 'DELETE' });
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
