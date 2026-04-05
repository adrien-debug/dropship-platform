'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAccountAuth } from '@/components/account/account-auth-provider';
import { shopFetch } from '@/lib/shop-api-client';
import type { ShopOrder } from '@/types/account';

interface OrderDetailResponse {
  error?: string;
  order?: ShopOrder;
  tracking?: { carrier: string | null; number: string | null; url: string | null };
}

export default function AccountOrderDetailPage(): React.ReactElement {
  const params = useParams();
  const orderId = typeof params.id === 'string' ? params.id : '';
  const { auth } = useAccountAuth();
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.customerId || !orderId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await shopFetch(`/api/customers/${auth.customerId}/orders/${orderId}`);
      const body = (await res.json()) as OrderDetailResponse;
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? 'Commande introuvable');
        setData(null);
        return;
      }
      setData(body);
    })().catch(() => {
      if (!cancelled) setError('Erreur réseau');
    });
    return () => {
      cancelled = true;
    };
  }, [auth?.customerId, orderId]);

  const o = data?.order;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/account/orders" className="text-sm font-medium" style={{ color: 'var(--dashboard-accent)' }}>
          ← Retour aux commandes
        </Link>
        <h1 className="mt-4 text-xl font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Détail commande
        </h1>
      </div>

      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}

      {o ? (
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
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt style={{ color: 'var(--dashboard-text-muted)' }}>Référence</dt>
              <dd className="mt-1 font-[family-name:var(--font-mono)]" style={{ color: 'var(--dashboard-text-primary)' }}>
                {o.id}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--dashboard-text-muted)' }}>Statut</dt>
              <dd className="mt-1" style={{ color: 'var(--dashboard-text-primary)' }}>
                {o.status}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--dashboard-text-muted)' }}>Montant</dt>
              <dd className="mt-1 text-lg font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: o.currency || 'EUR' }).format(
                  o.amountTotal,
                )}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--dashboard-text-muted)' }}>Passée le</dt>
              <dd className="mt-1" style={{ color: 'var(--dashboard-text-primary)' }}>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(
                  new Date(o.placedAt),
                )}
              </dd>
            </div>
          </dl>

          <div
            className="mt-6 border-t pt-6"
            style={{ borderColor: 'var(--dashboard-border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
              Suivi
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--dashboard-text-secondary)' }}>
              Numéro / référence transport (CRM <code className="font-[family-name:var(--font-mono)] text-xs">external_ref</code>
              ) :
            </p>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-sm" style={{ color: 'var(--dashboard-text-bright)' }}>
              {data?.tracking?.number ?? '—'}
            </p>
            {data?.tracking?.url ? (
              <a
                href={data.tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
                style={{ color: 'var(--dashboard-info)' }}
              >
                Ouvrir une recherche du numéro
              </a>
            ) : null}
          </div>
        </section>
      ) : !error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Chargement…
        </p>
      ) : null}
    </div>
  );
}
