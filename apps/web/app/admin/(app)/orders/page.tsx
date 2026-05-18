import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { PageHeader, StatusPill } from '@/app/admin/_components/AdminUI';
import { KpiGrid, KpiCard } from '@/components/cockpit/primitives';

export const dynamic = 'force-dynamic';

interface ForwardSummary {
  medusa_order_id: string;
  status: string;
  ae_order_id: string | null;
  dry_run: boolean;
  error_message: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AwaitingPaymentRow {
  medusa_order_id: string;
  ae_order_id: string;
  forwarded_at: string;
  customer_email: string | null;
  total_minor: number | null;
  currency_code: string | null;
  display_id: number | null;
}

export default async function OrdersPage() {
  // 3 queries indépendantes en parallèle au lieu de séquentiel.
  // - medusa.getOrders : appel HTTP Medusa (le plus lent)
  // - awaitingRaw : DB read query
  // (la query forwardsByOrder dépend de orders.id donc reste séquentielle après)
  const [ordersResult, awaitingResult] = await Promise.all([
    medusa.getOrders({ limit: 50 }).catch((e) => ({ error: e instanceof Error ? e.message : 'Unknown error', orders: [] as Awaited<ReturnType<typeof medusa.getOrders>>['orders'] })),
    getDbRead().query<{ medusa_order_id: string; ae_order_id: string; created_at: string }>(
      `SELECT medusa_order_id, ae_order_id, created_at
         FROM dropship_order_forwards
        WHERE status = 'sent' AND dry_run = false AND paid_at IS NULL
          AND ae_order_id IS NOT NULL
        ORDER BY created_at ASC`,
    ),
  ]);

  const orders = ordersResult.orders;
  const fetchError = 'error' in ordersResult ? ordersResult.error : null;
  const awaitingRaw = awaitingResult.rows;

  const ids = orders.map((o) => o.id);
  let forwardsByOrder = new Map<string, ForwardSummary>();
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await getDbRead().query<ForwardSummary>(
      `SELECT DISTINCT ON (medusa_order_id)
              medusa_order_id, status, ae_order_id, dry_run, error_message, paid_at, created_at
         FROM dropship_order_forwards
        WHERE medusa_order_id IN (${placeholders})
        ORDER BY medusa_order_id, created_at DESC`,
      ids,
    );
    forwardsByOrder = new Map(rows.map((r) => [r.medusa_order_id, r]));
  }

  // Hydrate with Medusa info for orders that scrolled off the limit-50 window.
  // Best-effort: a missing Medusa order shouldn't break the page.
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const missingIds = awaitingRaw.map((r) => r.medusa_order_id).filter((id) => !ordersById.has(id));
  const fetched = await Promise.all(missingIds.map((id) => medusa.getOrder(id).catch(() => null)));
  for (const o of fetched) {
    if (o) ordersById.set(o.id, o);
  }

  const awaitingPayment: AwaitingPaymentRow[] = awaitingRaw.map((r) => {
    const o = ordersById.get(r.medusa_order_id);
    return {
      medusa_order_id: r.medusa_order_id,
      ae_order_id: r.ae_order_id,
      forwarded_at: r.created_at,
      customer_email: o?.email ?? null,
      total_minor: o?.total ?? null,
      currency_code: o?.currency_code ?? null,
      display_id: o?.display_id ?? null,
    };
  });

  const stats = {
    paidOrders: orders.filter(
      (o) => o.payment_status === 'captured' || o.payment_status === 'authorized',
    ).length,
    awaitingPayment: awaitingPayment.length,
    paidAtAe: Array.from(forwardsByOrder.values()).filter(
      (f) => f.status === 'sent' && f.paid_at,
    ).length,
    errors: Array.from(forwardsByOrder.values()).filter((f) => f.status === 'error').length,
  };

  return (
    <div className="flex flex-col flex-1 space-y-4">
      <PageHeader
        kicker="Production · Dropship"
        title={
          <>
            Carnet de <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>commandes</em>
          </>
        }
        lede="Forward chaque commande payée vers AliExpress. Le dry-run sauve le payload sans rien envoyer."
        actions={<DryRunPendingButton />}
      />

      <KpiGrid>
        <KpiCard label="Commandes payées" value={String(stats.paidOrders)} />
        <KpiCard label="À payer chez AE" value={String(stats.awaitingPayment)} accent={stats.awaitingPayment > 0} />
        <KpiCard label="Payées chez AE" value={String(stats.paidAtAe)} accent={stats.paidAtAe > 0} />
        <KpiCard label="Erreurs forward" value={String(stats.errors)} />
      </KpiGrid>

      {fetchError && (
        <div className="ct-card" style={{ margin: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ct-text-muted)' }}>Erreur Medusa : {fetchError}</span>
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <section style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ct-border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.02em' }}>
                À payer <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>chez AliExpress</em>
              </h3>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ct-text-faint)' }}>
                · {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--ct-text-muted)', lineHeight: 1.6 }}>
              AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique <strong>Marquer payée</strong>. Annulation auto après <strong>20 jours</strong>.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ct-text-faint)', background: 'var(--ct-surface-2)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Commande</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Total</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Order AE</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Forwardée</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {awaitingPayment.map((row) => {
                  const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                  const ageHours = Math.floor(ageMs / 3_600_000);
                  const ageLabel =
                    ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                  const stale = ageHours >= 24 * 15;
                  return (
                    <tr key={row.medusa_order_id} style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--ct-text-primary)' }}>
                          #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ct-text-faint)', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                          {row.medusa_order_id}
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', color: 'var(--ct-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {row.customer_email ?? '—'}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-primary)' }}>
                        {row.total_minor != null && row.currency_code
                          ? formatMoney(row.total_minor, row.currency_code)
                          : '—'}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <a
                          href={aliExpressOrderUrl(row.ae_order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ct-accent)', fontFamily: 'monospace', fontSize: 11, textDecoration: 'underline' }}
                        >
                          {row.ae_order_id}
                          <span aria-hidden="true">↗</span>
                        </a>
                      </td>
                      <td style={{ padding: '6px 12px', fontSize: 11, color: stale ? 'var(--ct-text-muted)' : 'var(--ct-text-faint)' }}>
                        <StatusPill tone="neutral">il y a {ageLabel}</StatusPill>
                        {stale && <div style={{ marginTop: 2, fontSize: 10, fontWeight: 500, color: 'var(--ct-accent)' }}>proche annulation</div>}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <MarkPaidButton orderId={row.medusa_order_id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!fetchError && orders.length === 0 && (
        <div style={{
          flex: 1, minHeight: 0,
          border: '1px dashed var(--ct-border-strong)', borderRadius: 12,
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--ct-surface-1)',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ct-text-primary)' }}>Aucune commande pour le moment.</p>
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ct-text-muted)' }}>
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <section style={{ flex: 1, minHeight: 0, border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ct-border)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.02em' }}>
              Toutes les <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>commandes</em>
            </h3>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ct-text-faint)' }}>
              · {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ct-text-faint)', background: 'var(--ct-surface-2)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Commande</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Total</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Paiement</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>AliExpress</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const forward = forwardsByOrder.get(order.id) ?? null;
                  const sent = forward?.status === 'sent';
                  const paymentOk =
                    order.payment_status === 'captured' || order.payment_status === 'authorized';
                  return (
                    <tr key={order.id} style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--ct-text-primary)' }}>#{order.display_id ?? order.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 10, color: 'var(--ct-text-faint)', marginTop: 2 }}>
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ color: 'var(--ct-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                          {order.email ?? '—'}
                        </div>
                        {order.shipping_address?.city && (
                          <div style={{ fontSize: 10, color: 'var(--ct-text-faint)', marginTop: 2 }}>{order.shipping_address.city}</div>
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ct-text-primary)' }}>
                        {formatMoney(order.total, order.currency_code)}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <StatusPill tone={paymentOk ? 'emerald' : 'neutral'}>
                          {order.payment_status ?? order.status ?? '—'}
                        </StatusPill>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        {forward ? (
                          forward.status === 'sent' && forward.ae_order_id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <StatusPill tone={forward.paid_at ? 'emerald' : 'neutral'}>
                                {forward.paid_at ? 'payée' : 'à payer'}
                              </StatusPill>
                              <a
                                href={aliExpressOrderUrl(forward.ae_order_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--ct-text-faint)', textDecoration: 'underline' }}
                              >
                                {forward.ae_order_id}
                              </a>
                            </div>
                          ) : forward.status === 'dry_run' ? (
                            <StatusPill tone="emerald">dry-run prêt</StatusPill>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 200 }}>
                              <StatusPill tone="neutral">erreur</StatusPill>
                              {forward.error_message && (
                                <span style={{ fontSize: 10, color: 'var(--ct-text-faint)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties} title={forward.error_message}>
                                  {forward.error_message}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span style={{ color: 'var(--ct-text-faint)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <ForwardButton orderId={order.id} alreadySent={sent} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
