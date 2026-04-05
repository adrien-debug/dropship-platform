'use client';

import type { ShopAddress } from '@/types/account';

export function AddressCard({
  address,
  onEdit,
  onDelete,
}: {
  address: ShopAddress;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}): React.ReactElement {
  return (
    <article
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
      style={{
        borderRadius: 'var(--dashboard-radius-card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--dashboard-border)',
        background: 'var(--dashboard-card)',
      }}
    >
      <div>
        {address.label ? (
          <p className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
            {address.label}
            {address.isDefault ? (
              <span
                className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: 'var(--dashboard-accent-soft)',
                  color: 'var(--dashboard-accent)',
                }}
              >
                Par défaut
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
            Adresse
            {address.isDefault ? (
              <span
                className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: 'var(--dashboard-accent-soft)',
                  color: 'var(--dashboard-accent)',
                }}
              >
                Par défaut
              </span>
            ) : null}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--dashboard-text-secondary)' }}>
          {[address.line1, address.line2, [address.postalCode, address.city].filter(Boolean).join(' '), address.country]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(address.id)}
          className="rounded-xl px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--dashboard-border-mid)',
            color: 'var(--dashboard-text-primary)',
          }}
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onDelete(address.id)}
          className="rounded-xl px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ color: 'var(--dashboard-error)' }}
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}
