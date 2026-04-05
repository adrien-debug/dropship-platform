'use client';

import { useEffect, useState } from 'react';
import { ProfileForm } from '@/components/account/profile-form';
import { useAccountAuth } from '@/components/account/account-auth-provider';
import { shopFetch } from '@/lib/shop-api-client';
import type { ShopCustomer } from '@/types/account';

export default function AccountProfilePage(): React.ReactElement {
  const { auth } = useAccountAuth();
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.customerId) return;
    let cancelled = false;
    (async () => {
      const res = await shopFetch(`/api/customers/${auth.customerId}`);
      const data = (await res.json()) as { error?: string; customer?: ShopCustomer };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? 'Chargement impossible');
        return;
      }
      if (data.customer) setCustomer(data.customer);
    })().catch(() => {
      if (!cancelled) setError('Erreur réseau');
    });
    return () => {
      cancelled = true;
    };
  }, [auth?.customerId]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Profil
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Mettre à jour vos informations personnelles.
        </p>
      </header>
      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}
      {customer && auth?.customerId ? (
        <ProfileForm customerId={auth.customerId} initial={customer} />
      ) : !error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Chargement…
        </p>
      ) : null}
    </div>
  );
}
