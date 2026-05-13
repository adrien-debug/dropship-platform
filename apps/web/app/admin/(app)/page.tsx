import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { PageHeader, StatCard, SectionCard } from '../_components/AdminUI';
import { StoreLogo } from '@/components/ui';
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

  ]);

  const revenue30dCents = Number(revenue.revenue_30d_cents);
  const revenue7dCents = Number(revenue.revenue_7d_cents);
  const aov30dCents = Number(revenue.aov_30d_cents);

  const orders30d = revenue.orders_30d;
  const orders7d = revenue.orders_7d;

  const totalCost = Number(cost.total_cost_eur || 0);
  const avgPerRun = Number(cost.avg_cost_per_run || 0);
  const errorRate = cost.runs ? (cost.errors / cost.runs) * 100 : 0;

  return (
    <div className="space-y-3 flex flex-col flex-1 min-h-0">
      <PageHeader
        kicker="Portfolio"
        title={<span>Vue <em className="italic text-zinc-400">d&apos;ensemble</em></span>}
        lede="KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down."
      />

      {/* Row 1 — store + revenue snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/admin/stores" className="block hover:opacity-90 transition-opacity">
          <StatCard
            label="Stores actifs"
            value={stores.active.toString()}
            hint={
              stores.created_7d > 0 ? (
                <span className="text-indigo-600">+{stores.created_7d} cette semaine</span>
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

      {/* Row 3 — top stores + funnel + cost */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <SectionCard kicker="Performance 7j" title={<span>Top <em className="italic text-zinc-400">stores</em></span>}>
          <div className="space-y-2">
            {topStores.length === 0 && (
              <p className="text-sm text-zinc-400">Aucun store actif avec des ventes 7j.</p>
            )}
            {topStores.map((s) => (
              <Link
                key={s.slug}
                href={`/admin/stores`}
                className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 transition-colors"
              >
                <span className="text-indigo-600 inline-flex"><StoreLogo emoji={s.logo_emoji} size={20} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{s.name}</div>
                  <div className="text-xs text-zinc-400 truncate">/shop/{s.slug}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {eur(Number(s.revenue_cents))}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {s.orders} commande{s.orders > 1 ? 's' : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard kicker="Funnel 30j" title={<span>Conversion <em className="italic text-zinc-400">globale</em></span>}>
          <div>
            <FunnelBar label="View content" value={funnel.view_content} reference={funnel.view_content} tone="neutral" />
            <FunnelBar label="Add to cart" value={funnel.add_to_cart} reference={funnel.view_content} tone="blue" />
            <FunnelBar label="Initiate checkout" value={funnel.initiate_checkout} reference={funnel.view_content} tone="amber" />
            <FunnelBar label="Purchase" value={funnel.purchase} reference={funnel.view_content} tone="emerald" />
            <div className="mt-4 pt-3 border-t border-zinc-200 text-xs text-zinc-400 flex justify-between">
              <span>Conversion globale</span>
              <span className="font-medium text-zinc-900">
                {pct(funnel.purchase, funnel.view_content)}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard kicker="Coût Claude 30j" title={<span>Observabilité <em className="italic text-zinc-400">agent</em></span>}>
          <div className="space-y-3">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-zinc-900">
                {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Total des appels Anthropic
              </div>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-400">Runs</dt>
                <dd className="font-medium text-zinc-900">{cost.runs.toLocaleString('fr-FR')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-400">Coût moyen / run</dt>
                <dd className="font-medium text-zinc-900">
                  {(avgPerRun * 1000).toFixed(3)} m€
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-400">Taux d&apos;erreur</dt>
                <dd className={cn('font-medium', errorRate > 5 ? 'text-zinc-500' : 'text-zinc-900')}>
                  {errorRate.toFixed(1)}%
                </dd>
              </div>
            </dl>
            <Link
              href="/admin/observability"
              className="block text-center text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 rounded-xl px-3 py-2 transition-colors"
            >
              Voir le détail par step →
            </Link>
          </div>
        </SectionCard>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------

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
  // Gradient d'intensité sur l'accent : du plus foncé (top of funnel) au plus clair (bottom)
  const barColor = {
    neutral: 'bg-indigo-200',
    blue:    'bg-indigo-400',
    amber:   'bg-indigo-500',
    emerald: 'bg-indigo-600',
  }[tone];
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-600">{label}</span>
        <span className="font-medium text-zinc-900">
          {value.toLocaleString('fr-FR')}{' '}
          <span className="text-zinc-400 font-normal">
            ({reference > 0 ? Math.round(ratio * 100) : 0}%)
          </span>
        </span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={cn('h-full', barColor)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

