import Link from 'next/link';
import {
  Sparkles,
  Package,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatCard, StatusPill, SectionCard, type Tone } from '../_components/AdminUI';
import { StoreLogo } from '@/components/ui';
import { runAnomalyWatch } from '@/lib/ops/anomaly-watch';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Portfolio dashboard — the front door of the admin. Aggregates KPIs across
 * every store in `dropship_stores` so the operator gets a one-glance view
 * before drilling into any specific store. All queries hit the read replica
 * (or primary in dev) and fail-soft individually — one slow/missing source
 * never blocks the page.
 */

interface StoresRow {
  active: number;
  created_7d: number;
  total_products: number;
  products_7d: number;
}

interface RevenueRow {
  revenue_30d_cents: number;
  revenue_7d_cents: number;
  orders_30d: number;
  orders_7d: number;
  aov_30d_cents: number;
}

interface FunnelRow {
  view_content: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchase: number;
}

interface TopStoreRow {
  slug: string;
  name: string;
  logo_emoji: string;
  revenue_cents: number;
  orders: number;
}

interface CostRow {
  total_cost_eur: string;
  runs: number;
  errors: number;
  avg_cost_per_run: string;
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[dashboard] query failed:', e instanceof Error ? e.message : e);
    return fallback;
  }
}

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function pct(num: number, denom: number): string {
  if (!denom) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

export default async function PortfolioDashboard() {
  const db = getDbRead();

  const [stores, revenue, funnel, topStores, cost, anomalies] = await Promise.all([
    safeQuery<StoresRow>(
      async () => {
        const { rows } = await db.query<StoresRow>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS created_7d,
             COALESCE(SUM(product_count) FILTER (WHERE status = 'active'), 0)::int AS total_products,
             COALESCE(SUM(product_count) FILTER (WHERE created_at > now() - interval '7 days'), 0)::int AS products_7d
           FROM dropship_stores`,
        );
        return rows[0]!;
      },
      { active: 0, created_7d: 0, total_products: 0, products_7d: 0 },
    ),

    safeQuery<RevenueRow>(
      async () => {
        const { rows } = await db.query<RevenueRow>(
          `SELECT
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS revenue_30d_cents,
             COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days'), 0)::bigint AS revenue_7d_cents,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days')::int AS orders_30d,
             COUNT(*) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '7 days')::int AS orders_7d,
             COALESCE(AVG(value_minor) FILTER (WHERE event_name = 'purchase' AND created_at > now() - interval '30 days'), 0)::bigint AS aov_30d_cents
           FROM dropship_funnel_events`,
        );
        return rows[0]!;
      },
      { revenue_30d_cents: 0, revenue_7d_cents: 0, orders_30d: 0, orders_7d: 0, aov_30d_cents: 0 },
    ),

    safeQuery<FunnelRow>(
      async () => {
        const { rows } = await db.query<FunnelRow>(
          `SELECT
             COUNT(*) FILTER (WHERE event_name = 'view_content')::int AS view_content,
             COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS add_to_cart,
             COUNT(*) FILTER (WHERE event_name = 'initiate_checkout')::int AS initiate_checkout,
             COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchase
           FROM dropship_funnel_events
           WHERE created_at > now() - interval '30 days'`,
        );
        return rows[0]!;
      },
      { view_content: 0, add_to_cart: 0, initiate_checkout: 0, purchase: 0 },
    ),

    safeQuery<TopStoreRow[]>(
      async () => {
        const { rows } = await db.query<TopStoreRow>(
          `SELECT
             s.slug,
             s.name,
             s.logo_emoji,
             COALESCE(SUM(f.value_minor), 0)::bigint AS revenue_cents,
             COUNT(f.id)::int AS orders
           FROM dropship_stores s
           LEFT JOIN dropship_funnel_events f
             ON f.store_slug = s.slug
            AND f.event_name = 'purchase'
            AND f.created_at > now() - interval '7 days'
           WHERE s.status = 'active'
           GROUP BY s.slug, s.name, s.logo_emoji, s.created_at
           ORDER BY revenue_cents DESC NULLS LAST, s.created_at DESC
           LIMIT 5`,
        );
        return rows;
      },
      [],
    ),

    safeQuery<CostRow>(
      async () => {
        const { rows } = await db.query<CostRow>(
          `SELECT
             COALESCE(SUM(cost_eur), 0)::numeric(12,4)::text AS total_cost_eur,
             COUNT(*)::int AS runs,
             COUNT(*) FILTER (WHERE error_json IS NOT NULL)::int AS errors,
             COALESCE(AVG(cost_eur), 0)::numeric(12,6)::text AS avg_cost_per_run
           FROM dropship_ai_runs
           WHERE created_at > now() - interval '30 days'`,
        );
        return rows[0]!;
      },
      { total_cost_eur: '0', runs: 0, errors: 0, avg_cost_per_run: '0' },
    ),

    safeQuery(
      async () => runAnomalyWatch(),
      {
        ok: true as const,
        generated_at: new Date().toISOString(),
        total: 0,
        counts: { stranded: 0, stuck: 0, errors: 0 },
        stranded: [],
        stuck: [],
        errors: [],
        warnings: [],
      },
    ),
  ]);

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const aov30dCents = Number(revenue.aov_30d_cents);

  const orders30d = revenue.orders_30d;
  const orders7d = revenue.orders_7d;

  const alertsCount =
    anomalies.stranded.length + anomalies.stuck.length + anomalies.errors.length;

  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Portfolio"
        title={<span>Vue <em className="italic text-ds-text-muted">d&apos;ensemble</em></span>}
        lede="KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down."
      />

      {/* Row 1 — store + revenue snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/stores" className="block hover:opacity-90 transition-opacity">
          <StatCard
            label="Stores actifs"
            value={stores.active.toString()}
            hint={
              stores.created_7d > 0 ? (
                <span className="text-[var(--success)]">+{stores.created_7d} cette semaine</span>
              ) : (
                'Aucun nouveau store 7j'
              )
            }
          />
        </Link>
        <Link href="/admin/catalog" className="block hover:opacity-90 transition-opacity">
          <StatCard
            label="Produits"
            value={stores.total_products.toLocaleString('fr-FR')}
            hint={stores.products_7d > 0 ? `+${stores.products_7d} 7j` : '—'}
          />
        </Link>
        <StatCard
          label="CA 30j"
          value={eur(revenue30dCents)}
          hint={`${orders30d} commande${orders30d > 1 ? 's' : ''} · ${eur(aov30dCents)} AOV`}
          tone={revenue30dCents > 0 ? 'emerald' : 'neutral'}
        />
        <StatCard
          label="CA 7j"
          value={eur(revenue7dCents)}
          hint={`${orders7d} commande${orders7d > 1 ? 's' : ''}`}
          tone={revenue7dCents > 0 ? 'emerald' : 'neutral'}
        />
      </div>

      {/* Row 2 — alerts banner */}
      <SectionCard
        kicker={alertsCount === 0 ? 'Statut ops' : `${alertsCount} alerte${alertsCount > 1 ? 's' : ''}`}
        title={
          alertsCount === 0 ? (
            <span className="text-[var(--success)]">
              Tout est sous contrôle <em className="italic text-ds-text-muted font-light">(aucune anomalie)</em>
            </span>
          ) : (
            <span className="text-[var(--danger)]">
              Anomalies à traiter <em className="italic text-ds-text-muted font-light">(détectées par le watcher)</em>
            </span>
          )
        }
      >
        <div className="px-6 py-5 space-y-2">
          {alertsCount === 0 && (
            <p className="text-sm text-ds-text-muted">
              Aucun forward AliExpress en erreur, aucune commande Stripe orpheline, aucun token API expiré.
            </p>
          )}
          {anomalies.stranded.slice(0, 5).map((a) => (
            <AlertRow
              key={`s-${a.medusa_order_id}`}
              tone="red"
              label="Forward AE bloqué"
              detail={`Commande ${a.medusa_order_id.slice(0, 8)}… · ${Math.round(a.age_days)}j sans paiement (annulation AE proche)`}
              href={`/admin/orders`}
            />
          ))}
          {anomalies.stuck.slice(0, 5).map((a) => (
            <AlertRow
              key={`p-${a.medusa_order_id}`}
              tone="amber"
              label="Stripe payé sans forward"
              detail={`Commande ${a.medusa_order_id.slice(0, 8)}… · ${Math.round(a.age_hours)}h depuis paiement`}
              href={`/admin/orders`}
            />
          ))}
          {anomalies.errors.slice(0, 5).map((a) => (
            <AlertRow
              key={`e-${a.medusa_order_id}`}
              tone="red"
              label="Forward en erreur"
              detail={`Commande ${a.medusa_order_id.slice(0, 8)}… · ${a.error_message?.slice(0, 80) || 'erreur inconnue'}`}
              href={`/admin/orders`}
            />
          ))}
          {anomalies.warnings.length > 0 && (
            <p className="text-xs text-ds-text-muted italic mt-3">
              {anomalies.warnings.join(' · ')}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Row 3 — top stores + funnel + cost */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard kicker="Performance 7j" title={<span>Top <em className="italic text-ds-text-muted">stores</em></span>}>
          <div className="p-6 space-y-3">
            {topStores.length === 0 && (
              <p className="text-sm text-ds-text-muted">Aucun store actif avec des ventes 7j.</p>
            )}
            {topStores.map((s) => (
              <Link
                key={s.slug}
                href={`/admin/stores`}
                className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-ds-surface-default transition-colors"
              >
                <span className="text-ds-text-secondary inline-flex"><StoreLogo emoji={s.logo_emoji} size={20} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ds-text-primary truncate">{s.name}</div>
                  <div className="text-xs text-ds-text-muted truncate">/shop/{s.slug}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-ds-text-primary">
                    {eur(Number(s.revenue_cents))}
                  </div>
                  <div className="text-xs text-ds-text-muted">
                    {s.orders} commande{s.orders > 1 ? 's' : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard kicker="Funnel 30j" title={<span>Conversion <em className="italic text-ds-text-muted">globale</em></span>}>
          <div className="p-6">
            <FunnelBar label="View content" value={funnel.view_content} reference={funnel.view_content} tone="neutral" />
            <FunnelBar label="Add to cart" value={funnel.add_to_cart} reference={funnel.view_content} tone="blue" />
            <FunnelBar label="Initiate checkout" value={funnel.initiate_checkout} reference={funnel.view_content} tone="amber" />
            <FunnelBar label="Purchase" value={funnel.purchase} reference={funnel.view_content} tone="emerald" />
            <div className="mt-4 pt-3 border-t border-ds-border-subtle text-xs text-ds-text-muted flex justify-between">
              <span>Conversion globale</span>
              <span className="font-medium text-ds-text-primary">
                {pct(funnel.purchase, funnel.view_content)}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard kicker="Coût Claude 30j" title={<span>Observabilité <em className="italic text-ds-text-muted">agent</em></span>}>
          <div className="p-6 space-y-4">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-ds-text-primary">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div className="text-xs text-ds-text-muted mt-1">
                Total des appels Anthropic
              </div>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ds-text-muted">Runs</dt>
                <dd className="font-medium text-ds-text-primary">{cost.runs.toLocaleString('fr-FR')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ds-text-muted">Coût moyen / run</dt>
                <dd className="font-medium text-ds-text-primary">
                  {(avgPerRun * 1000).toFixed(3)} m€
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ds-text-muted">Taux d&apos;erreur</dt>
                <dd className={cn('font-medium', errorRate > 5 ? 'text-[var(--danger)]' : 'text-ds-text-primary')}>
                  {errorRate.toFixed(1)}%
                </dd>
              </div>
            </dl>
            <Link
              href="/admin/observability"
              className="block text-center text-xs font-medium text-ds-text-secondary hover:text-ds-text-primary border border-ds-border-subtle hover:border-ds-border-default rounded-lg px-3 py-2 transition-colors"
            >
              Voir le détail par step →
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* Quick links */}
      <SectionCard kicker="Actions" title={<span>Raccourcis <em className="italic text-ds-text-muted">opérations</em></span>}>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink href="/admin/stores/new" Icon={Sparkles} label="Créer un store" hint="Agent en 25-40s" />
          <QuickLink href="/admin/orders" Icon={Package} label="Commandes" hint="Forwards AE" />
          <QuickLink href="/admin/observability" Icon={BarChart3} label="Observabilité" hint="Coûts IA" />
          <QuickLink href="/admin/settings" Icon={Settings} label="Réglages" hint="Tokens & ops" />
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AlertRow({
  tone,
  label,
  detail,
  href,
}: {
  tone: Tone;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 -mx-2 px-2 py-2 rounded-md hover:bg-ds-surface-default transition-colors"
    >
      <span className="mt-0.5">
        <StatusPill tone={tone}>{label}</StatusPill>
      </span>
      <span className="text-xs text-ds-text-secondary leading-relaxed flex-1">{detail}</span>
    </Link>
  );
}

function FunnelBar({
  label,
  value,
  reference,
  tone,
}: {
  label: string;
  value: number;
  reference: number;
  tone: 'neutral' | 'blue' | 'amber' | 'emerald';
}) {
  const ratio = reference > 0 ? Math.min(1, value / reference) : 0;
  const barColor = {
    neutral: 'bg-ds-text-muted',
    blue: 'bg-[var(--accent-blue)]',
    amber: 'bg-[var(--warning)]',
    emerald: 'bg-[var(--success)]',
  }[tone];
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ds-text-secondary">{label}</span>
        <span className="font-medium text-ds-text-primary">
          {value.toLocaleString('fr-FR')}{' '}
          <span className="text-ds-text-muted font-normal">
            ({reference > 0 ? Math.round(ratio * 100) : 0}%)
          </span>
        </span>
      </div>
      <div className="h-2 bg-ds-surface-default rounded-full overflow-hidden">
        <div className={cn('h-full', barColor)} style={{ width: `${ratio * 100}%`, opacity: 0.7 }} />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  Icon,
  label,
  hint,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group border border-ds-border-subtle hover:border-ds-border-default rounded-lg px-4 py-3 transition-colors bg-ds-surface-subtle hover:bg-ds-surface-default"
    >
      <Icon size={22} strokeWidth={1.5} className="text-ds-text-secondary group-hover:text-ds-text-primary mb-2 transition-colors" aria-hidden />
      <div className="text-sm font-medium text-ds-text-primary">{label}</div>
      <div className="text-xs text-ds-text-muted">{hint}</div>
    </Link>
  );
}
