'use client';

import Link from 'next/link';
import type { ShopOrder } from '@/types/account';

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(
    amount,
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function OrderCard({ order }: { order: ShopOrder }): React.ReactElement {
  return (
    <article
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderRadius: 'var(--dashboard-radius-card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--dashboard-border)',
        background: 'var(--dashboard-card)',
      }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
          {formatDate(order.placedAt)}
        </p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-sm" style={{ color: 'var(--dashboard-text-ghost)' }}>
          #{order.id.slice(0, 8)}
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--dashboard-text-secondary)' }}>
          Statut :{' '}
          <span style={{ color: 'var(--dashboard-text-primary)' }}>{order.status}</span>
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="text-lg font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          {formatMoney(order.amountTotal, order.currency)}
        </p>
        <Link
          href={`/account/orders/${order.id}`}
          className="text-sm font-medium underline-offset-4 hover:underline"
          style={{ color: 'var(--dashboard-accent)' }}
        >
          Détails
        </Link>
      </div>
    </article>
  );
}
