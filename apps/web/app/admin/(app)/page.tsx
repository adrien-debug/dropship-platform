import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getDbRead } from '@/lib/db';
import { PageHeader } from '@/app/admin/_components/AdminUI';
import { StoreAvatar, ButtonLink } from '@/components/ui';
// Cockpit primitives — KPI grid + cards
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';

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
            Vue <em style={{ fontStyle: 'normal', color: 'var(--ct-text-muted)', fontWeight: 300 }}>d&apos;ensemble</em>
          </span>
        }
        lede="KPIs agrégés sur tous les stores actifs. Cliquez sur un bloc pour drill down."
      />

      {/* Row 1 — KPIs (Cockpit KpiGrid) */}
      <KpiGrid>
        <Link href="/admin/stores" style={{ display: 'block', textDecoration: 'none' }}>
          <KpiCard
            label="Stores actifs"
            value={stores.active.toString()}
          />
        </Link>
        <Link href="/admin/catalog" style={{ display: 'block', textDecoration: 'none' }}>
          <KpiCard
            label="Produits"
            value={stores.total_products.toLocaleString('fr-FR')}
          />
        </Link>
        <KpiCard
          label="CA 30j"
          value={eur(revenue30dCents)}
          accent={revenue30dCents > 0}
        />
        <KpiCard
          label="CA 7j"
          value={eur(revenue7dCents)}
          accent={revenue7dCents > 0}
        />
      </KpiGrid>

      {/* Row 2 — Top stores + Funnel + Coût Claude */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flex: 1, minHeight: 0 }}>
        {/* ─── Top stores ─────────────────────────────────────────── */}
        <div className="ct-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)' }}>
                Performance 7j
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', marginTop: 2 }}>
                Top <em style={{ fontStyle: 'normal', color: 'var(--ct-text-muted)', fontWeight: 300 }}>stores</em>
              </p>
            </div>
            <Link
              href="/admin/stores"
              style={{ fontSize: 11, fontWeight: 500, color: 'var(--ct-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}
            >
              Tous
              <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            </Link>
          </div>
          {topStores.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ct-text-faint)', padding: '8px 0' }}>
              Aucun store actif avec des ventes 7j.
            </p>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {topStores.map((s, idx) => (
                <li key={s.slug} style={{ borderTop: idx > 0 ? '1px solid var(--ct-border-soft)' : 'none' }}>
                  <Link
                    href={`/admin/stores/${s.slug}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 0', textDecoration: 'none',
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ width: 16, fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-faint)', textAlign: 'right' }}>
                      {idx + 1}
                    </span>
                    <StoreAvatar slug={s.slug} name={s.name} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ct-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        /shop/{s.slug}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: Number(s.revenue_cents) > 0 ? 'var(--ct-text-primary)' : 'var(--ct-text-faint)' }}>
                        {eur(Number(s.revenue_cents))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ct-text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                        {s.orders} cmd
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ─── Funnel ─────────────────────────────────────────────── */}
        <div className="ct-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)' }}>
                Funnel 30j
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', marginTop: 2 }}>
                Conversion <em style={{ fontStyle: 'normal', color: 'var(--ct-text-muted)', fontWeight: 300 }}>globale</em>
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-primary)' }}>
              {globalConv.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FunnelBar label="View content" value={funnel.view_content} reference={funnel.view_content} intensity={1.0} />
            <FunnelBar label="Add to cart" value={funnel.add_to_cart} reference={funnel.view_content} intensity={0.75} />
            <FunnelBar label="Initiate checkout" value={funnel.initiate_checkout} reference={funnel.view_content} intensity={0.5} />
            <FunnelBar label="Purchase" value={funnel.purchase} reference={funnel.view_content} intensity={0.25} highlight />
          </div>
        </div>

        {/* ─── Coût Claude ────────────────────────────────────────── */}
        <div className="ct-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ct-text-muted)', marginBottom: 4 }}>
              Coût Claude 30j
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)' }}>
              Observabilité <em style={{ fontStyle: 'normal', color: 'var(--ct-text-muted)', fontWeight: 300 }}>agent</em>
            </p>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ct-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {totalCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ct-text-muted)' }}>
              Total des appels Anthropic
            </div>
          </div>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <Stat label="Runs" value={cost.runs.toLocaleString('fr-FR')} />
            <Stat label="Coût moyen / run" value={`${(avgPerRun * 1000).toFixed(3)} m€`} />
            <Stat label="Taux d'erreur" value={`${errorRate.toFixed(1)}%`} tone={errorRate > 5 ? 'warning' : 'normal'} />
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
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <dt style={{ color: 'var(--ct-text-muted)' }}>{label}</dt>
      <dd style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tone === 'warning' ? 'var(--ct-accent-strong)' : 'var(--ct-text-primary)' }}>
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
  intensity: number;
  highlight?: boolean;
}) {
  const ratio = reference > 0 ? Math.min(1, value / reference) : 0;
  const pctValue = reference > 0 ? Math.round(ratio * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: highlight ? 'var(--ct-text-primary)' : 'var(--ct-text-body)', fontWeight: highlight ? 500 : 400 }}>
          {label}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: highlight ? 'var(--ct-text-primary)' : 'var(--ct-text-body)', fontWeight: highlight ? 600 : 500 }}>
            {value.toLocaleString('fr-FR')}
          </span>
          <span style={{ color: 'var(--ct-text-faint)', marginLeft: 6 }}>{pctValue}%</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            borderRadius: 9999,
            transition: 'width 300ms',
            width: `${ratio * 100}%`,
            background: highlight ? 'var(--ct-accent-strong)' : 'var(--ct-text-primary)',
            opacity: highlight ? 1 : 0.45 + intensity * 0.4,
          }}
        />
      </div>
    </div>
  );
}
