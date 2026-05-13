'use client';

export function StoreLayoutClient({
  storeId: _storeId,
  storeSlug: _storeSlug,
  storeName: _storeName,
  children,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
