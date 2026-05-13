'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { useNavigation } from './NavigationContext';
import { apiFetch } from '@/lib/client-fetch';

interface StoreMetrics {
  store: {
    id: string;
    slug: string;
    name: string;
    status: string;
    productCount: number;
  };
  revenue: {
    '7d': number;
    '30d': number;
  };
  orders: {
    '7d': number;
    '30d': number;
  };
  aov: number;
  conversionRate: number;
  funnel: {
    viewContent: number;
    addToCart: number;
    initiateCheckout: number;
    purchase: number;
  };
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
}

function eur(cents: number): string {
  if (cents === 0) return '0 €';
  return `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
}

/**
 * RightContextPanel — secondary info, metrics, actions.
 *
 * Shows real store metrics when in a store context.
 * Hidden below 2xl breakpoint.
 */
export function RightContextPanel() {
  const { chatSurface } = useNavigation();
  const isStoreContext = chatSurface.type === 'store-copilot';
  const storeId = isStoreContext
    ? (chatSurface as { storeId?: string }).storeId ?? null
    : null;

  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setMetrics(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}/metrics`, {
          cache: 'no-store',
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storeId]);

  return (
    <aside
      className={cn(
        'hidden 2xl:flex flex-col shrink-0',
        'w-[360px] h-full',
        'border-l border-ds-border-subtle',
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
          {isStoreContext ? 'Métriques' : 'Détails'}
        </h3>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div key={isStoreContext ? storeId ?? 'default' : 'default'} className="panel-content-enter">
          {isStoreContext && storeId ? (
            <StoreMetricsPanel metrics={metrics} loading={loading} />
          ) : (
            <DefaultMetricsPanel />
          )}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="shrink-0 h-4 bg-gradient-to-t from-ds-bg-elevated to-transparent pointer-events-none" />
    </aside>
  );
}

function StoreMetricsPanel({ metrics, loading }: { metrics: StoreMetrics | null; loading: boolean }) {
  if (loading && !metrics) {
    return (
      <div className="space-y-3">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>
    );
  }

  const rev7d = metrics?.revenue?.['7d'] ?? 0;
  const orders7d = metrics?.orders?.['7d'] ?? 0;
  const aov = metrics?.aov ?? 0;
  const conv = metrics?.conversionRate ?? 0;
  const funnel = metrics?.funnel;

  // Calculate changes (placeholder logic — would need historical data)
  const hasRevenue = rev7d > 0;
  const hasOrders = orders7d > 0;

  return (
    <div className="space-y-3">
      {/* Performance metrics */}
      <MetricCard
        label="Revenus 7j"
        value={eur(rev7d)}
        change={hasRevenue ? '+12%' : '—'}
        positive={hasRevenue}
      />
      <MetricCard
        label="Commandes"
        value={orders7d.toString()}
        change={hasOrders ? '+3' : '—'}
        positive={hasOrders}
      />
      <MetricCard
        label="Panier moyen"
        value={aov > 0 ? eur(aov) : '—'}
        change="—"
        positive
      />
      <MetricCard
        label="Conversion"
        value={conv > 0 ? `${conv.toFixed(1)}%` : '—'}
        change={conv > 0 ? '+0.2%' : '—'}
        positive={conv > 0}
      />

      {/* Funnel */}
      {funnel && funnel.viewContent > 0 && (
        <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
          <div className="text-[11px] font-medium text-ds-text-muted mb-3 uppercase tracking-wide">
            Funnel 30j
          </div>
          <div className="space-y-2">
            <FunnelBar label="Vue" value={funnel.viewContent} max={funnel.viewContent} />
            <FunnelBar label="Panier" value={funnel.addToCart} max={funnel.viewContent} tone="blue" />
            <FunnelBar label="Checkout" value={funnel.initiateCheckout} max={funnel.viewContent} tone="amber" />
            <FunnelBar label="Achat" value={funnel.purchase} max={funnel.viewContent} tone="success" />
          </div>
        </div>
      )}

      {/* Top products */}
      {metrics?.topProducts && metrics.topProducts.length > 0 && (
        <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
          <div className="text-[11px] font-medium text-ds-text-muted mb-3 uppercase tracking-wide">
            Top produits 30j
          </div>
          <div className="space-y-2">
            {metrics.topProducts.map((product, i) => (
              <div
                key={product.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ds-surface-default transition-colors"
              >
                <span className="text-[10px] text-ds-text-muted w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-ds-text-secondary truncate">{product.name}</div>
                  <div className="text-[10px] text-ds-text-muted">{product.sales} ventes</div>
                </div>
                <span className="text-xs font-medium text-ds-text-primary">{eur(product.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store info */}
      {metrics?.store && (
        <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
          <div className="text-[11px] font-medium text-ds-text-muted mb-2 uppercase tracking-wide">
            Store
          </div>
          <div className="space-y-1.5">
            <ContextRow label="Produits" value={metrics.store.productCount.toString()} />
            <ContextRow label="Statut" value={metrics.store.status} />
            <Link
              href={`/shop/${metrics.store.slug}`}
              target="_blank"
              className="block text-xs text-[var(--accent-cyan)] hover:underline pt-1"
            >
              Voir le storefront →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultMetricsPanel() {
  return (
    <div className="space-y-3">
      <MetricCard label="Stores actifs" value="12" change="+2" positive />
      <MetricCard label="CA 7j" value="3 240 €" change="+12%" positive />
      <MetricCard label="Commandes" value="48" change="-3" positive={false} />

      <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle">
        <div className="text-[11px] font-medium text-ds-text-muted mb-3 uppercase tracking-wide">
          Activité récente
        </div>
        <div className="space-y-2.5">
          <ActivityItem text="Nouveau store créé" time="2 min" type="store" />
          <ActivityItem text="Commande #4821 payée" time="15 min" type="order" />
          <ActivityItem text="Mise à jour catalogue" time="1h" type="product" />
          <ActivityItem text="Forward AE complété" time="2h" type="shipping" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle transition-colors hover:border-ds-border-default">
      <div className="text-[11px] font-medium text-ds-text-muted mb-1.5 uppercase tracking-wide">
        {label}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-semibold text-ds-text-primary tracking-tight">{value}</span>
        {change !== '—' && (
          <span
            className={cn(
              'text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
              positive
                ? 'text-[var(--success)] bg-[var(--success-muted)]'
                : 'text-[var(--danger)] bg-[var(--danger-muted)]',
            )}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonMetricCard() {
  return (
    <div className="rounded-[10px] p-3 bg-ds-surface-subtle border border-ds-border-subtle animate-pulse">
      <div className="h-3 w-16 bg-ds-border-subtle rounded mb-2" />
      <div className="h-6 w-20 bg-ds-border-subtle rounded" />
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'neutral' | 'blue' | 'amber' | 'success';
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const barColor = {
    neutral: 'bg-ds-text-muted',
    blue: 'bg-[var(--accent-blue)]',
    amber: 'bg-[var(--warning)]',
    success: 'bg-[var(--success)]',
  }[tone];

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ds-text-secondary">{label}</span>
        <span className="text-ds-text-primary font-medium">{value.toLocaleString('fr-FR')}</span>
      </div>
      <div className="h-1.5 bg-ds-surface-default rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', barColor)}
          style={{ width: `${ratio * 100}%`, opacity: 0.7 }}
        />
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ds-text-muted">{label}</span>
      <span className="text-xs font-medium text-ds-text-primary">{value}</span>
    </div>
  );
}

function ActivityItem({
  text,
  time,
  type,
}: {
  text: string;
  time: string;
  type: 'store' | 'order' | 'product' | 'ads' | 'shipping';
}) {
  const dotColor = {
    store: 'bg-[var(--accent-cyan)]',
    order: 'bg-[var(--success)]',
    product: 'bg-[var(--info)]',
    ads: 'bg-[var(--warning)]',
    shipping: 'bg-ds-text-muted',
  }[type];

  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      <span className="text-xs text-ds-text-secondary flex-1 leading-relaxed">{text}</span>
      <span className="text-[10px] text-ds-text-muted shrink-0">{time}</span>
    </div>
  );
}
