'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { useNavigation } from './NavigationContext';
import { apiFetch } from '@/lib/client-fetch';

interface StoreStats {
  status: string;
  productCount: number;
  revenue7d: number;
  orderCount: number;
}

/**
 * LeftContextPanel — contextual information on the left.
 *
 * Shows real store data when in a store context.
 * Hidden below xl breakpoint.
 */
export function LeftContextPanel() {
  const { chatSurface } = useNavigation();
  const isStoreContext = chatSurface.type === 'store-copilot';
  const storeId = isStoreContext
    ? (chatSurface as { storeId?: string }).storeId ?? null
    : null;
  const storeName = isStoreContext
    ? (chatSurface as { storeName?: string }).storeName ?? 'Store'
    : null;

  const [stats, setStats] = useState<StoreStats | null>(null);
  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string | null;
    mode: string;
    updated_at: string;
    message_count: number;
  }>>([]);

  useEffect(() => {
    if (!storeId) {
      setStats(null);
      setSessions([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          apiFetch(`/api/agent/stores/${storeId}/copilot/bootstrap`, { cache: 'no-store' }),
          apiFetch(`/api/agent/stores/${storeId}/copilot/sessions`, { cache: 'no-store' }),
        ]);

        if (statsRes.ok && !cancelled) {
          const data = await statsRes.json();
          setStats({
            status: data.status ?? 'unknown',
            productCount: data.products?.length ?? 0,
            revenue7d: 0, // TODO: add revenue query
            orderCount: 0, // TODO: add order query
          });
        }

        if (sessionsRes.ok && !cancelled) {
          const data = await sessionsRes.json();
          setSessions((data.sessions ?? []).slice(0, 5));
        }
      } catch { /* ignore */ }
    }

    load();
    return () => { cancelled = true; };
  }, [storeId]);

  return (
    <aside
      className={cn(
        'hidden xl:flex flex-col shrink-0',
        'w-[300px] h-full',
        'border-r border-ds-border-subtle',
        'bg-ds-bg-elevated',
      )}
    >
      {/* Panel Header */}
      <div
        className={cn(
          'shrink-0 h-[48px] flex items-center px-4',
          'border-b border-ds-border-subtle',
          'bg-ds-bg-elevated/80 backdrop-blur-sm',
        )}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ds-text-muted">
          {isStoreContext ? storeName : 'Navigation'}
        </h3>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div key={isStoreContext ? storeId ?? 'default' : 'default'} className="panel-content-enter">
          {isStoreContext && storeId ? (
            <StoreContextPanel storeId={storeId} storeName={storeName!} stats={stats} sessions={sessions} />
          ) : (
            <DefaultContextPanel />
          )}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="shrink-0 h-4 bg-gradient-to-t from-ds-bg-elevated to-transparent pointer-events-none" />
    </aside>
  );
}

function StoreContextPanel({
  storeId,
  storeName,
  stats,
  sessions,
}: {
  storeId: string;
  storeName: string;
  stats: StoreStats | null;
  sessions: Array<{ id: string; title: string | null; mode: string; updated_at: string; message_count: number }>;
}) {
  return (
    <div className="space-y-3">
      {/* Store quick stats */}
      <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
        <div className="text-[11px] font-medium text-ds-text-muted mb-2 uppercase tracking-wide">
          {storeName}
        </div>
        <div className="space-y-2">
          <ContextRow
            label="Statut"
            value={stats?.status ?? '—'}
            status={stats?.status === 'active' ? 'success' : stats?.status === 'creating' ? 'warning' : undefined}
          />
          <ContextRow label="Produits" value={stats?.productCount?.toString() ?? '—'} />
          <ContextRow label="CA 7j" value="—" />
          <ContextRow label="Commandes" value="—" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
        <div className="text-[11px] font-medium text-ds-text-muted mb-2 uppercase tracking-wide">
          Actions rapides
        </div>
        <div className="space-y-1">
          <Link
            href={`/shop/${storeId}`}
            target="_blank"
            className="block px-2.5 py-1.5 rounded-lg text-xs text-ds-text-secondary hover:bg-ds-surface-default hover:text-ds-text-primary transition-colors"
          >
            Voir le storefront →
          </Link>
          <Link
            href={`/admin/stores/${storeId}/catalog`}
            className="block px-2.5 py-1.5 rounded-lg text-xs text-ds-text-secondary hover:bg-ds-surface-default hover:text-ds-text-primary transition-colors"
          >
            Gérer le catalogue
          </Link>
          <Link
            href={`/admin/stores/${storeId}/analytics`}
            className="block px-2.5 py-1.5 rounded-lg text-xs text-ds-text-secondary hover:bg-ds-surface-default hover:text-ds-text-primary transition-colors"
          >
            Analytics
          </Link>
          <Link
            href={`/admin/stores/${storeId}/settings`}
            className="block px-2.5 py-1.5 rounded-lg text-xs text-ds-text-secondary hover:bg-ds-surface-default hover:text-ds-text-primary transition-colors"
          >
            Paramètres
          </Link>
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
          <div className="text-[11px] font-medium text-ds-text-muted mb-2 uppercase tracking-wide">
            Sessions récentes
          </div>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="px-2.5 py-2 rounded-lg hover:bg-ds-surface-default transition-colors cursor-pointer"
              >
                <div className="text-xs text-ds-text-secondary font-medium truncate">
                  {session.title || 'Sans titre'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-ds-surface-default text-ds-text-muted capitalize">
                    {session.mode}
                  </span>
                  <span className="text-[10px] text-ds-text-muted">
                    {session.message_count} msg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultContextPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
        <div className="text-[11px] font-medium text-ds-text-muted mb-2 uppercase tracking-wide">
          Raccourcis
        </div>
        <div className="space-y-1">
          {[
            { label: 'Dashboard', href: '/admin' },
            { label: 'Stores', href: '/admin/stores' },
            { label: 'Commandes', href: '/admin/orders' },
            { label: 'Observabilité', href: '/admin/observability' },
            { label: 'Réglages', href: '/admin/settings' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-2.5 py-1.5 rounded-lg text-xs text-ds-text-secondary hover:bg-ds-surface-default hover:text-ds-text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContextRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'success' | 'warning' | 'danger';
}) {
  const statusColor =
    status === 'success'
      ? 'text-[var(--success)]'
      : status === 'warning'
        ? 'text-[var(--warning)]'
        : status === 'danger'
          ? 'text-[var(--danger)]'
          : 'text-ds-text-primary';

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ds-text-muted">{label}</span>
      <span className={cn('text-xs font-medium', statusColor)}>{value}</span>
    </div>
  );
}
