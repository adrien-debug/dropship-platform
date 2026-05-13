import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { formatMoney } from '@/lib/medusa-store';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}

interface AcquisitionRow {
  source: string;
  campaign: string;
  visits: number;
  adds_to_cart: number;
  initiate_checkouts: number;
  purchases: number;
  revenue_minor: number;
}

interface FunnelRow {
  event_name: string;
  sessions: number;
  events: number;
  revenue_minor: number;
}

const RANGE_TO_INTERVAL: Record<string, { label: string; sql: string }> = {
  '7d': { label: '7 jours', sql: "interval '7 days'" },
  '30d': { label: '30 jours', sql: "interval '30 days'" },
  '90d': { label: '90 jours', sql: "interval '90 days'" },
};

const FUNNEL_ORDER = ['add_to_cart', 'initiate_checkout', 'purchase'] as const;
const FUNNEL_LABEL: Record<string, string> = {
  add_to_cart: 'Ajouts au panier',
  initiate_checkout: 'Checkouts initiés',
  purchase: 'Achats',
};

export default async function StoreAnalyticsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { range = '30d' } = await searchParams;
  const db = getDbRead();

  const storeRes = await db.query<{
    slug: string;
    name: string;
    clarity_id: string | null;
    ga4_measurement_id: string | null;
    meta_pixel_id: string | null;
    tiktok_pixel_id: string | null;
  }>(
    `SELECT slug, name, clarity_id, ga4_measurement_id, meta_pixel_id, tiktok_pixel_id
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const cfg = RANGE_TO_INTERVAL[range] ?? RANGE_TO_INTERVAL['30d']!;
  const intervalSql = cfg.sql;

  // ============ UA — Acquisition ============
  const acquisitionRes = await db.query<AcquisitionRow>(
    `SELECT
       COALESCE(NULLIF(utm_source, ''), '(direct)') AS source,
       COALESCE(NULLIF(utm_campaign, ''), '(none)') AS campaign,
       COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart')::int AS visits,
       COUNT(*) FILTER (WHERE event_name = 'add_to_cart')::int AS adds_to_cart,
       COUNT(*) FILTER (WHERE event_name = 'initiate_checkout')::int AS initiate_checkouts,
       COUNT(*) FILTER (WHERE event_name = 'purchase')::int AS purchases,
       COALESCE(SUM(value_minor) FILTER (WHERE event_name = 'purchase'), 0)::int AS revenue_minor
     FROM dropship_funnel_events
     WHERE store_slug = $1 AND created_at >= now() - ${intervalSql}
     GROUP BY source, campaign
     ORDER BY revenue_minor DESC, purchases DESC, adds_to_cart DESC
     LIMIT 50`,
    [store.slug],
  );

  // ============ UX — Funnel ============
  const funnelRes = await db.query<FunnelRow>(
    `SELECT
       event_name,
       COUNT(DISTINCT session_id)::int AS sessions,
       COUNT(*)::int AS events,
       COALESCE(SUM(value_minor), 0)::int AS revenue_minor
     FROM dropship_funnel_events
     WHERE store_slug = $1 AND created_at >= now() - ${intervalSql}
       AND event_name = ANY($2::text[])
     GROUP BY event_name`,
    [store.slug, [...FUNNEL_ORDER]],
  );
  const funnelByName = new Map(funnelRes.rows.map((r) => [r.event_name, r]));

  // ============ Aggregates ============
  const totalRevenue = acquisitionRes.rows.reduce((acc, r) => acc + (r.revenue_minor || 0), 0);
  const totalPurchases = acquisitionRes.rows.reduce((acc, r) => acc + (r.purchases || 0), 0);
  const totalAdds = acquisitionRes.rows.reduce((acc, r) => acc + (r.adds_to_cart || 0), 0);
  const aov = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const cartToPurchase = totalAdds > 0 ? (totalPurchases / totalAdds) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href={`/admin/stores/${id}`} className="text-sm text-zinc-400 hover:underline">
          ← {store.name}
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            Analytics · {store.name}
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Acquisition <em className="italic text-zinc-600">&amp; comportement</em>
          </h2>
          <p className="mt-2 text-sm text-zinc-400">Période : {cfg.label}.</p>
        </div>
        <div className="flex items-center gap-1 border border-zinc-200 rounded-full p-1 bg-zinc-50">
          {Object.entries(RANGE_TO_INTERVAL).map(([key, c]) => (
            <Link
              key={key}
              href={`?range=${key}`}
              className={
                'px-4 py-1.5 rounded-full text-xs uppercase tracking-cta font-medium transition-colors ' +
                (key === range ? 'bg-zinc-950 text-white' : 'text-zinc-400 hover:text-zinc-900')
              }
            >
              {c.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Aggregate KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Revenu" value={totalRevenue > 0 ? formatMoney(totalRevenue / 100, 'eur') : '—'} />
        <Kpi label="Commandes" value={String(totalPurchases)} />
        <Kpi label="Panier moyen" value={aov > 0 ? formatMoney(aov / 100, 'eur') : '—'} />
        <Kpi
          label="Conv. cart → purchase"
          value={totalAdds > 0 ? `${cartToPurchase.toFixed(1)} %` : '—'}
          tone={cartToPurchase >= 30 ? 'emerald' : cartToPurchase >= 15 ? 'amber' : 'red'}
        />
      </section>

      {/* UX — Funnel */}
      <section className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
        <div className="px-6 py-4 border-b border-zinc-200/60">
          <h3 className="text-base font-semibold tracking-tight">
            Comportement <em className="italic text-zinc-600">(UX)</em>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Funnel des sessions uniques sur les events serveur. Les session_id se persistent 30 jours.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {(() => {
            const top = funnelByName.get(FUNNEL_ORDER[0])?.sessions ?? 0;
            return FUNNEL_ORDER.map((name) => {
              const row = funnelByName.get(name);
              const sessions = row?.sessions ?? 0;
              const ratio = top > 0 ? (sessions / top) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex items-baseline justify-between gap-4 mb-1.5">
                    <span className="text-sm font-medium text-zinc-900">{FUNNEL_LABEL[name]}</span>
                    <span className="text-sm tabular-nums text-zinc-600">
                      {sessions} sessions{' '}
                      <span className="text-xs text-zinc-400">({ratio.toFixed(0)} %)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 rounded-full transition-all"
                      style={{ width: `${Math.max(2, ratio)}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {store.clarity_id && (
          <div className="px-6 py-3 border-t border-zinc-200/60 bg-zinc-50/60 text-xs text-zinc-400">
            Pour les replays vidéo et les heatmaps, ouvre le projet sur{' '}
            <a
              href={`https://clarity.microsoft.com/projects/view/${store.clarity_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-zinc-900"
            >
              Microsoft Clarity ↗
            </a>
            .
          </div>
        )}
      </section>

      {/* UA — Acquisition by source/campaign */}
      <section className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
        <div className="px-6 py-4 border-b border-zinc-200/60">
          <h3 className="text-base font-semibold tracking-tight">
            Acquisition <em className="italic text-zinc-600">(UA)</em>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Décomposition par utm_source / utm_campaign. Les visiteurs sans UTM sont regroupés sous{' '}
            <code className="text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded">(direct)</code>.
          </p>
        </div>
        {acquisitionRes.rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            Aucun événement enregistré sur cette période.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/60 text-kicker uppercase tracking-header text-zinc-400">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Source</th>
                <th className="text-left px-5 py-3 font-medium">Campagne</th>
                <th className="text-right px-5 py-3 font-medium">Sessions</th>
                <th className="text-right px-5 py-3 font-medium">Cart</th>
                <th className="text-right px-5 py-3 font-medium">Checkout</th>
                <th className="text-right px-5 py-3 font-medium">Achats</th>
                <th className="text-right px-5 py-3 font-medium">Revenu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {acquisitionRes.rows.map((r, i) => {
                const conv = r.adds_to_cart > 0 ? (r.purchases / r.adds_to_cart) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-zinc-50/60">
                    <td className="px-5 py-3 font-medium">{r.source}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.campaign}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-600">{r.visits}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-600">{r.adds_to_cart}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-zinc-600">{r.initiate_checkouts}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="font-medium">{r.purchases}</span>
                      {r.adds_to_cart > 0 && (
                        <span className="text-kicker text-zinc-400 ml-1.5">{conv.toFixed(0)} %</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tracking-tight">
                      {r.revenue_minor > 0 ? formatMoney(r.revenue_minor / 100, 'eur') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Pixel/CAPI status */}
      <section className="border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/40 px-6 py-5">
        <h4 className="text-xs uppercase tracking-label text-zinc-400 font-medium mb-3">
          Plomberie connectée
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <ConnState label="GA4" set={!!store.ga4_measurement_id} />
          <ConnState label="Meta Pixel" set={!!store.meta_pixel_id} />
          <ConnState label="TikTok Pixel" set={!!store.tiktok_pixel_id} />
          <ConnState label="Clarity" set={!!store.clarity_id} />
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          IDs vides ?{' '}
          <Link href={`/admin/stores/${id}`} className="underline underline-offset-2 hover:text-zinc-900">
            Configure-les sur la fiche du store ↗
          </Link>
        </p>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald' | 'amber' | 'red';
}) {
  const cls: Record<string, string> = {
    neutral: 'text-zinc-900',
    emerald: 'text-indigo-600',
    amber: 'text-indigo-600',
    red: 'text-zinc-500',
  };
  return (
    <div className="border border-zinc-200 bg-zinc-50 rounded-xl px-5 py-4">
      <div className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${cls[tone]}`}>{value}</div>
    </div>
  );
}

function ConnState({ label, set }: { label: string; set: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${set ? 'bg-[var(--success-muted)]0' : 'bg-ds-text-muted'}`}
        aria-hidden="true"
      />
      <span className={set ? 'text-zinc-900 font-medium' : 'text-zinc-400'}>{label}</span>
      <span className="text-kicker uppercase tracking-cta text-zinc-400 ml-auto">
        {set ? 'connecté' : 'inactif'}
      </span>
    </div>
  );
}
