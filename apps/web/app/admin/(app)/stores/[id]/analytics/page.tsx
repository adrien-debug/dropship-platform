import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { formatMoney } from '@/lib/medusa-store';
import { PageHeader } from '@/app/admin/_components/AdminUI';
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';

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
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
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
    [storeId],
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
    <div className="flex flex-col flex-1 space-y-4">
      <PageHeader
        kicker={`Analytics · ${store.name}`}
        title={<span>Acquisition <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>&amp; comportement</em></span>}
        lede={`Période : ${cfg.label}.`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ct-border)', borderRadius: 9999, padding: 4, background: 'var(--ct-surface-2)' }}>
            {Object.entries(RANGE_TO_INTERVAL).map(([key, c]) => (
              <Link
                key={key}
                href={`?range=${key}`}
                style={{
                  padding: '4px 16px',
                  borderRadius: 9999,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: key === range ? 'var(--ct-accent)' : 'transparent',
                  color: key === range ? '#fff' : 'var(--ct-text-muted)',
                  transition: 'background 150ms, color 150ms',
                }}
              >
                {c.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Aggregate KPIs */}
      <KpiGrid>
        <KpiCard label="Revenu" value={totalRevenue > 0 ? formatMoney(totalRevenue / 100, 'eur') : '—'} />
        <KpiCard label="Commandes" value={String(totalPurchases)} />
        <KpiCard label="Panier moyen" value={aov > 0 ? formatMoney(aov / 100, 'eur') : '—'} />
        <KpiCard label="Conv. cart → purchase" value={totalAdds > 0 ? `${cartToPurchase.toFixed(1)} %` : '—'} accent={cartToPurchase >= 30} />
      </KpiGrid>

      {/* UX — Funnel */}
      <section style={{ border: '1px solid var(--ct-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--ct-surface-1)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ct-border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.01em' }}>
            Comportement <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>(UX)</em>
          </h3>
          <p style={{ fontSize: 11, color: 'var(--ct-text-muted)', marginTop: 2 }}>
            Funnel des sessions uniques sur les events serveur. Les session_id se persistent 30 jours.
          </p>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(() => {
            const top = funnelByName.get(FUNNEL_ORDER[0])?.sessions ?? 0;
            return FUNNEL_ORDER.map((name) => {
              const row = funnelByName.get(name);
              const sessions = row?.sessions ?? 0;
              const ratio = top > 0 ? (sessions / top) * 100 : 0;
              return (
                <div key={name}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ct-text-primary)' }}>{FUNNEL_LABEL[name]}</span>
                    <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-body)' }}>
                      {sessions} sessions{' '}
                      <span style={{ fontSize: 11, color: 'var(--ct-text-faint)' }}>({ratio.toFixed(0)} %)</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--ct-surface-3)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div
                      style={{ height: '100%', background: 'var(--ct-accent)', borderRadius: 9999, transition: 'width 300ms', width: `${Math.max(2, ratio)}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {store.clarity_id && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--ct-border-soft)', background: 'var(--ct-surface-2)', fontSize: 11, color: 'var(--ct-text-faint)' }}>
            Pour les replays vid&eacute;o et les heatmaps, ouvre le projet sur{' '}
            <a
              href={`https://clarity.microsoft.com/projects/view/${store.clarity_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', textUnderlineOffset: 2, color: 'var(--ct-text-muted)' }}
            >
              Microsoft Clarity &#8599;
            </a>
            .
          </div>
        )}
      </section>

      {/* UA — Acquisition by source/campaign */}
      <section style={{ border: '1px solid var(--ct-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--ct-surface-1)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ct-border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.01em' }}>
            Acquisition <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>(UA)</em>
          </h3>
          <p style={{ fontSize: 11, color: 'var(--ct-text-muted)', marginTop: 2 }}>
            D&eacute;composition par utm_source / utm_campaign. Les visiteurs sans UTM sont regroup&eacute;s sous{' '}
            <code style={{ fontSize: 10, background: 'var(--ct-surface-3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', color: 'var(--ct-text-body)' }}>(direct)</code>.
          </p>
        </div>
        {acquisitionRes.rows.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ct-text-faint)' }}>
            Aucun &eacute;v&eacute;nement enregistr&eacute; sur cette p&eacute;riode.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-faint)', background: 'var(--ct-surface-2)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Source</th>
                <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 500 }}>Campagne</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Sessions</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Cart</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Checkout</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Achats</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 500 }}>Revenu</th>
              </tr>
            </thead>
            <tbody>
              {acquisitionRes.rows.map((r, i) => {
                const conv = r.adds_to_cart > 0 ? (r.purchases / r.adds_to_cart) * 100 : 0;
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
                    <td style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--ct-text-primary)' }}>{r.source}</td>
                    <td style={{ padding: '12px 20px', color: 'var(--ct-text-body)' }}>{r.campaign}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-body)' }}>{r.visits}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-body)' }}>{r.adds_to_cart}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-body)' }}>{r.initiate_checkouts}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 500, color: 'var(--ct-text-primary)' }}>{r.purchases}</span>
                      {r.adds_to_cart > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--ct-text-faint)', marginLeft: 6 }}>{conv.toFixed(0)} %</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-primary)' }}>
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
      <section style={{ border: '1px dashed var(--ct-border-strong)', borderRadius: 12, background: 'var(--ct-surface-1)', padding: '16px 20px' }}>
        <h4 style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-muted)', fontWeight: 700, marginBottom: 12 }}>
          Plomberie connect&eacute;e
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 13 }}>
          <ConnState label="GA4" set={!!store.ga4_measurement_id} />
          <ConnState label="Meta Pixel" set={!!store.meta_pixel_id} />
          <ConnState label="TikTok Pixel" set={!!store.tiktok_pixel_id} />
          <ConnState label="Clarity" set={!!store.clarity_id} />
        </div>
        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--ct-text-faint)' }}>
          IDs vides ?{' '}
          <Link href={`/admin/stores/${id}/settings`} style={{ textDecoration: 'underline', textUnderlineOffset: 2, color: 'var(--ct-text-muted)' }}>
            Configure-les dans les R&eacute;glages
          </Link>
        </p>
      </section>
    </div>
  );
}

function ConnState({ label, set }: { label: string; set: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span
        style={{ display: 'inline-block', height: 6, width: 6, borderRadius: '50%', background: set ? 'var(--ct-accent)' : 'var(--ct-border-strong)', flexShrink: 0 }}
        aria-hidden="true"
      />
      <span style={{ fontWeight: set ? 600 : 400, color: set ? 'var(--ct-text-primary)' : 'var(--ct-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ct-text-faint)', marginLeft: 'auto' }}>
        {set ? 'connecté' : 'inactif'}
      </span>
    </div>
  );
}
