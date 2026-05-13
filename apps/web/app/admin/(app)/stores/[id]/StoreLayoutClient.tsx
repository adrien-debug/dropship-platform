'use client';

import { useEffect } from 'react';
import { useStoreChat } from '@/components/layout/NavigationContext';

export function StoreLayoutClient({
  storeId,
  storeSlug,
  storeName,
  children,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  children: React.ReactNode;
}) {
  const { activate, deactivate } = useStoreChat(storeId, storeSlug, storeName);

  useEffect(() => {
    activate();
    return () => deactivate();
  }, [activate, deactivate]);

  return <>{children}</>;
}
