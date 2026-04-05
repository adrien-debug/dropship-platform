'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { OnePieceHeader } from '@/components/one-piece-header';
import { OnePieceFooter } from '@/components/one-piece-footer';

export function ShopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <OnePieceHeader />
      <main className="min-h-[60vh]">{children}</main>
      <OnePieceFooter />
    </>
  );
}
