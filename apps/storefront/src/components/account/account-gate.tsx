'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccountAuth } from './account-auth-provider';

export function AccountGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { auth } = useAccountAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth?.customerId) {
      router.replace('/login');
    }
  }, [auth?.customerId, router]);

  if (!auth?.customerId) {
    return (
      <div
        className="min-h-screen p-8 text-sm"
        style={{ color: 'var(--dashboard-text-muted)' }}
      >
        Redirection…
      </div>
    );
  }

  return <>{children}</>;
}
