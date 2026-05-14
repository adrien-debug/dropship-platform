import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatCard, SectionCard } from '../_components/AdminUI';
import { StoreAvatar, ButtonLink } from '@/components/ui';
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

export default async function PortfolioDashboard() {
  const db = getDbRead();

  const [stores, revenue, funnel, topStores, cost] = await Promise.all([
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
           LIMIT 7`,
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

  ]);

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const aov30dCents = Number(revenue.aov_30d_cents);

  const orders30d = revenue.orders_30d;
  const orders7d = revenue.orders_7d;

  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;
  const globalConv = funnel.view_content > 0 ? (funnel.purchase / funnel.view_content) * 100 : 0;

  return (
    <div className="space-y-4 flex flex-col flex-1 min-h-0">
      <PageHeader
        kicker="Portfolio"
        title={
          <span>
            Vue <em className="not-italic text-admin-text-muted font-light">d&apos;ensemble</em>
          </span>
        }
        lede="KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down."
      />

      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/admin/stores" className="block group rounded-admin-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-text/20">
          <StatCard
            label="Stores actifs"
            value={stores.active.toString()}
            hint={
              stores.created_7d > 0 ? (
                <span className="text-admin-accent font-medium">+{stores.created_7d} cette semaine</span>
              ) : (
                'Aucun nouveau store 7j'
              )
            }
          />
        </Link>
        <Link href="/admin/catalog" className="block group rounded-admin-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-text/20">
          <StatCard
            label="Produits"
            value={stores.total_products.toLocaleString('fr-FR')}
            hint={stores.products_7d > 0 ? `+${stores.products_7d} cette semaine` : 'Aucun nouveau 7j'}
          />
        </Link>
        <StatCard
          label="CA 30j"
          value={eur(revenue30dCents)}
          hint={
            <span>
              <span className="tabular-nums">{orders30d}</span> commande{orders30d > 1 ? 's' : ''}
              <span className="text-admin-text-faint mx-1.5">·</span>
              <span className="tabular-nums">{eur(aov30dCents)}</span> AOV
            </span>
          }
          tone={revenue30dCents > 0 ? 'emerald' : 'neutral'}
        />
        <StatCard
          label="CA 7j"
          value={eur(revenue7dCents)}
          hint={
            <span>
              <span className="tabular-nums">{orders7d}</span> commande{orders7d > 1 ? 's' : ''}
            </span>
          }
          tone={revenue7dCents > 0 ? 'emerald' : 'neutral'}
        />
      </div>

      {/* Row 2 — Top stores + Funnel + Coût Claude */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        {/* ─── Top stores ─────────────────────────────────────────── */}
        <SectionCard
          kicker="Performance 7j"
          title={<span>Top <em className="not-italic text-admin-text-muted font-light">stores</em></span>}
          actions={
            <Link
              href="/admin/stores"
              className="text-[11px] font-medium text-admin-text-muted hover:text-admin-text transition-colors flex items-center gap-0.5"
            >
              Tous
              <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            </Link>
          }
        >
          <div className="-mx-1.5">
            {topStores.length === 0 ? (
              <p className="px-1.5 py-2 text-sm text-admin-text-faint">
                Aucun store actif avec des ventes 7j.
              </p>
            ) : (
              <ul className="divide-y divide-admin-border-soft">
                {topStores.map((s, idx) => (
                  <li key={s.slug}>
                    <Link
                      href={`/admin/stores/${s.slug}`}
                      className="group flex items-center gap-3 px-1.5 py-2 rounded-admin-md hover:bg-admin-bg-subtle focus-visible:outline-none focus-visible:bg-admin-bg-subtle focus-visible:ring-2 focus-visible:ring-admin-border-strong transition-colors"
                    >
                      <span className="w-4 text-[11px] tabular-nums text-admin-text-faint text-right">
                        {idx + 1}
                      </span>
                      <StoreAvatar slug={s.slug} name={s.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-admin-text truncate leading-tight">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-admin-text-faint truncate tabular-nums">
                          /shop/{s.slug}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={cn(
                            'text-[13px] font-semibold tabular-nums leading-tight',
                            Number(s.revenue_cents) > 0 ? 'text-admin-text' : 'text-admin-text-faint',
                          )}
                        >
                          {eur(Number(s.revenue_cents))}
                        </div>
                        <div className="text-[11px] text-admin-text-faint tabular-nums">
                          {s.orders} cmd
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        {/* ─── Funnel ─────────────────────────────────────────────── */}
        <SectionCard
          kicker="Funnel 30j"
          title={<span>Conversion <em className="not-italic text-admin-text-muted font-light">globale</em></span>}
          actions={
            <span className="text-[11px] font-semibold tabular-nums text-admin-text">
              {globalConv.toFixed(1)}%
            </span>
          }
        >
          <div className="space-y-3">
            <FunnelBar label="View content" value={funnel.view_content} reference={funnel.view_content} intensity={1.0} />
            <FunnelBar label="Add to cart" value={funnel.add_to_cart} reference={funnel.view_content} intensity={0.75} />
            <FunnelBar label="Initiate checkout" value={funnel.initiate_checkout} reference={funnel.view_content} intensity={0.5} />
            <FunnelBar label="Purchase" value={funnel.purchase} reference={funnel.view_content} intensity={0.25} highlight />
          </div>
        </SectionCard>

        {/* ─── Coût Claude ────────────────────────────────────────── */}
        <SectionCard
          kicker="Coût Claude 30j"
          title={<span>Observabilité <em className="not-italic text-admin-text-muted font-light">agent</em></span>}
        >
          <div className="space-y-4">
            <div>
              <div className="text-[22px] font-semibold tracking-[-0.025em] text-admin-text tabular-nums leading-none">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div className="mt-1.5 text-[11px] text-admin-text-muted">
                Total des appels Anthropic
              </div>
            </div>
            <dl className="space-y-2 text-[13px]">
              <Stat label="Runs" value={cost.runs.toLocaleString('fr-FR')} />
              <Stat
                label="Coût moyen / run"
                value={`${(avgPerRun * 1000).toFixed(3)} m€`}
              />
              <Stat
                label="Taux d'erreur"
                value={`${errorRate.toFixed(1)}%`}
                tone={errorRate > 5 ? 'warning' : 'normal'}
              />
            </dl>
            <ButtonLink
              href="/admin/observability"
              variant="secondary"
              size="sm"
              className="w-full"
              trailing={<ArrowUpRight size={12} strokeWidth={2} aria-hidden />}
            >
              Détail par step
            </ButtonLink>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-admin-text-muted">{label}</dt>
      <dd
        className={cn(
          'font-semibold tabular-nums',
          tone === 'warning' ? 'text-admin-warning' : 'text-admin-text',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  reference,
  intensity,
  highlight = false,
}: {
  label: string;
  value: number;
  reference: number;
  /** 0..1 — controls bar opacity so top of funnel is darker, bottom lighter. */
  intensity: number;
  highlight?: boolean;
}) {
  const ratio = reference > 0 ? Math.min(1, value / reference) : 0;
  const pctValue = reference > 0 ? Math.round(ratio * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1 leading-tight">
        <span className={cn(highlight ? 'text-admin-text font-medium' : 'text-admin-text-secondary')}>
          {label}
        </span>
        <span className="tabular-nums">
          <span className={cn(highlight ? 'text-admin-text font-semibold' : 'text-admin-text-secondary font-medium')}>
            {value.toLocaleString('fr-FR')}
          </span>
          <span className="text-admin-text-faint ml-1.5">{pctValue}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-admin-bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', highlight ? 'bg-admin-accent' : 'bg-admin-text')}
          style={{
            width: `${ratio * 100}%`,
            opacity: highlight ? 1 : 0.45 + intensity * 0.4,
          }}
        />
      </div>
    </div>
  );
}
