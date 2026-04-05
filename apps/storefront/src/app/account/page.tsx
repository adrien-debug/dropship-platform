'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { OrderCard } from '@/components/account/order-card';
import { useAccountAuth } from '@/components/account/account-auth-provider';
import { shopFetch } from '@/lib/shop-api-client';
import type { ShopAddress, ShopCustomer, ShopOrder, ShopOrdersSummary } from '@/types/account';

export default function AccountDashboardPage(): React.ReactElement {
  const { auth } = useAccountAuth();
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [summary, setSummary] = useState<ShopOrdersSummary | null>(null);
  const [recent, setRecent] = useState<ShopOrder[]>([]);
  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.customerId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await shopFetch(`/api/customers/${auth.customerId}`);
      const data = (await res.json()) as {
        error?: string;
        customer?: ShopCustomer;
        ordersSummary?: ShopOrdersSummary;
        orders?: ShopOrder[];
        addresses?: ShopAddress[];
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? 'Chargement impossible');
        return;
      }
      if (data.customer) setCustomer(data.customer);
      if (data.ordersSummary) setSummary(data.ordersSummary);
      setRecent((data.orders ?? []).slice(0, 5));
      setAddresses(data.addresses ?? []);
    })().catch(() => {
      if (!cancelled) setError('Erreur réseau');
    });
    return () => {
      cancelled = true;
    };
  }, [auth?.customerId]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Vue d’ensemble
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Informations personnelles, commandes récentes et adresses.
        </p>
      </header>

      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}

      <section
        className="p-5"
        style={{
          borderRadius: 'var(--dashboard-radius-card)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--dashboard-border)',
          background: 'var(--dashboard-card)',
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
          Profil
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt style={{ color: 'var(--dashboard-text-muted)' }}>Nom</dt>
            <dd style={{ color: 'var(--dashboard-text-primary)' }}>{customer?.name ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--dashboard-text-muted)' }}>E-mail</dt>
            <dd style={{ color: 'var(--dashboard-text-primary)' }}>{customer?.email ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--dashboard-text-muted)' }}>Téléphone</dt>
            <dd style={{ color: 'var(--dashboard-text-primary)' }}>{customer?.phone ?? '—'}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--dashboard-text-muted)' }}>Client depuis</dt>
            <dd style={{ color: 'var(--dashboard-text-primary)' }}>
              {customer?.signupAt
                ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(customer.signupAt))
                : '—'}
            </dd>
          </div>
        </dl>
        {summary ? (
          <div className="mt-6 grid gap-4 border-t pt-4 sm:grid-cols-3" style={{ borderColor: 'var(--dashboard-border)' }}>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
                Commandes
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
                {summary.orderCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
                LTV ({summary.currency})
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
                {summary.lifetimeValue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
                Dernière commande
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-primary)' }}>
                {summary.lastOrderAt
                  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                      new Date(summary.lastOrderAt),
                    )
                  : '—'}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <Link href="/account/profile" className="text-sm font-medium" style={{ color: 'var(--dashboard-accent)' }}>
            Modifier le profil
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
            Commandes récentes
          </h2>
          <Link href="/account/orders" className="text-sm font-medium" style={{ color: 'var(--dashboard-accent)' }}>
            Tout voir
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
              Aucune commande pour le moment.
            </p>
          ) : (
            recent.map(o => <OrderCard key={o.id} order={o} />)
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
            Adresses
          </h2>
          <Link href="/account/addresses" className="text-sm font-medium" style={{ color: 'var(--dashboard-accent)' }}>
            Gérer
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {addresses.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
              Aucune adresse enregistrée.
            </p>
          ) : (
            addresses.slice(0, 3).map(a => (
              <div
                key={a.id}
                className="p-4 text-sm"
                style={{
                  borderRadius: 'var(--dashboard-radius-card)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--dashboard-border)',
                  background: 'var(--dashboard-card)',
                  color: 'var(--dashboard-text-secondary)',
                }}
              >
                {[a.line1, a.city, a.country].filter(Boolean).join(', ')}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
