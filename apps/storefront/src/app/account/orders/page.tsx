'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrderCard } from '@/components/account/order-card';
import { useAccountAuth } from '@/components/account/account-auth-provider';
import { shopFetch } from '@/lib/shop-api-client';
import { SHOP_ORDER_STATUS_FILTERS, type ShopOrder, type ShopOrderStatusFilter } from '@/types/account';

export default function AccountOrdersPage(): React.ReactElement {
  const { auth } = useAccountAuth();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [status, setStatus] = useState<ShopOrderStatusFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => (status === 'all' ? '' : `?status=${encodeURIComponent(status)}`), [status]);

  useEffect(() => {
    if (!auth?.customerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await shopFetch(`/api/customers/${auth.customerId}/orders${query}`);
      const data = (await res.json()) as { error?: string; orders?: ShopOrder[] };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? 'Chargement impossible');
        setOrders([]);
        setLoading(false);
        return;
      }
      setOrders(data.orders ?? []);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError('Erreur réseau');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [auth?.customerId, query]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Commandes
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Historique filtrable par statut.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {SHOP_ORDER_STATUS_FILTERS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
            style={{
              background: status === s ? 'var(--dashboard-accent-soft)' : 'var(--dashboard-card)',
              color: status === s ? 'var(--dashboard-accent)' : 'var(--dashboard-text-secondary)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--dashboard-border)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Chargement…
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
              Aucune commande pour ce filtre.
            </p>
          ) : (
            orders.map(o => <OrderCard key={o.id} order={o} />)
          )}
        </div>
      )}
    </div>
  );
}
