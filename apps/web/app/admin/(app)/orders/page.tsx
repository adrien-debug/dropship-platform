import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { PageHeader, StatCard, StatusPill } from '../../_components/AdminUI';

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

  const awaitingTotal = awaitingPayment.reduce((acc, r) => acc + (r.total_minor ?? 0), 0);
  const awaitingCurrency = awaitingPayment[0]?.currency_code ?? null;

  return (
    <div className="flex flex-col flex-1 space-y-4">
      <PageHeader
        kicker="Production · Dropship"
        title={
          <>
            Carnet de <em className="italic text-zinc-400">commandes</em>
          </>
        }
        lede="Forward chaque commande payée vers AliExpress. Le dry-run sauve le payload sans rien envoyer."
        actions={<DryRunPendingButton />}
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Commandes payées" value={String(stats.paidOrders)} hint="Sur les 50 dernières" />
        <StatCard
          label="À payer chez AE"
          value={String(stats.awaitingPayment)}
          hint={
            stats.awaitingPayment > 0 && awaitingCurrency
              ? `Total : ${formatMoney(awaitingTotal, awaitingCurrency)}`
              : 'Aucune en attente'
          }
          tone={stats.awaitingPayment > 0 ? 'amber' : 'neutral'}
        />
        <StatCard
          label="Payées chez AE"
          value={String(stats.paidAtAe)}
          tone={stats.paidAtAe > 0 ? 'emerald' : 'neutral'}
        />
        <StatCard
          label="Erreurs forward"
          value={String(stats.errors)}
          tone={stats.errors > 0 ? 'red' : 'neutral'}
        />
      </section>

      {fetchError && (
        <div className="border border-zinc-200 bg-white rounded-xl p-3 text-xs text-zinc-500 shadow-sm">
          Erreur Medusa : {fetchError}
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-100">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold tracking-[-0.02em] text-zinc-900">
                À payer <em className="italic text-zinc-400">chez AliExpress</em>
              </h3>
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">
                · {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 max-w-3xl leading-relaxed">
              AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique <strong>Marquer payée</strong>. Annulation auto après <strong>20 jours</strong>.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50/60 text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Commande</th>
                  <th className="text-left px-3 py-2 font-medium">Client</th>
                  <th className="text-left px-3 py-2 font-medium">Total</th>
                  <th className="text-left px-3 py-2 font-medium">Order AE</th>
                  <th className="text-left px-3 py-2 font-medium">Forwardée</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {awaitingPayment.map((row) => {
                  const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                  const ageHours = Math.floor(ageMs / 3_600_000);
                  const ageLabel =
                    ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                  const stale = ageHours >= 24 * 15;
                  return (
                    <tr key={row.medusa_order_id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-zinc-900">
                          #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[140px]">{row.medusa_order_id}</div>
                      </td>
                      <td className="px-3 py-1.5 text-zinc-500 truncate max-w-[160px]">{row.customer_email ?? '—'}</td>
                      <td className="px-3 py-1.5 font-semibold tabular-nums text-zinc-900">
                        {row.total_minor != null && row.currency_code
                          ? formatMoney(row.total_minor, row.currency_code)
                          : '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        <a
                          href={aliExpressOrderUrl(row.ae_order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 underline underline-offset-4 decoration-indigo-200 hover:decoration-indigo-500 font-mono text-[11px]"
                        >
                          {row.ae_order_id}
                          <span aria-hidden="true">↗</span>
                        </a>
                      </td>
                      <td className={`px-3 py-1.5 text-[11px] ${stale ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        <StatusPill tone={stale ? 'red' : 'amber'}>il y a {ageLabel}</StatusPill>
                        {stale && <div className="mt-0.5 text-[10px] font-medium text-zinc-500">proche annulation</div>}
                      </td>
                      <td className="px-3 py-1.5 text-right">
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
        <div className="flex-1 min-h-0 border border-dashed border-zinc-200 rounded-xl px-6 py-12 text-center bg-white shadow-sm">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">Aucune commande pour le moment.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <section className="flex-1 min-h-0 border border-zinc-200 bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-baseline gap-2">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-zinc-900">
              Toutes les <em className="italic text-zinc-400">commandes</em>
            </h3>
            <span className="text-[11px] uppercase tracking-wider text-zinc-400">
              · {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50/60 text-[10px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Commande</th>
                  <th className="text-left px-3 py-2 font-medium">Client</th>
                  <th className="text-left px-3 py-2 font-medium">Total</th>
                  <th className="text-left px-3 py-2 font-medium">Paiement</th>
                  <th className="text-left px-3 py-2 font-medium">AliExpress</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => {
                  const forward = forwardsByOrder.get(order.id) ?? null;
                  const sent = forward?.status === 'sent';
                  const paymentOk =
                    order.payment_status === 'captured' || order.payment_status === 'authorized';
                  return (
                    <tr key={order.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-zinc-900">#{order.display_id ?? order.id.slice(0, 8)}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="text-zinc-500 truncate max-w-[160px]">{order.email ?? '—'}</div>
                        {order.shipping_address?.city && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">{order.shipping_address.city}</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-semibold tabular-nums text-zinc-900">
                        {formatMoney(order.total, order.currency_code)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusPill tone={paymentOk ? 'emerald' : 'zinc'}>
                          {order.payment_status ?? order.status ?? '—'}
                        </StatusPill>
                      </td>
                      <td className="px-3 py-1.5">
                        {forward ? (
                          forward.status === 'sent' && forward.ae_order_id ? (
                            <div className="flex flex-col gap-0.5">
                              <StatusPill tone={forward.paid_at ? 'emerald' : 'amber'}>
                                {forward.paid_at ? 'payée' : 'à payer'}
                              </StatusPill>
                              <a
                                href={aliExpressOrderUrl(forward.ae_order_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] text-zinc-400 hover:text-indigo-600 hover:underline underline-offset-2"
                              >
                                {forward.ae_order_id}
                              </a>
                            </div>
                          ) : forward.status === 'dry_run' ? (
                            <StatusPill tone="blue">dry-run prêt</StatusPill>
                          ) : (
                            <div className="flex flex-col gap-0.5 max-w-[200px]">
                              <StatusPill tone="red">erreur</StatusPill>
                              {forward.error_message && (
                                <span className="text-[10px] text-zinc-400 line-clamp-2" title={forward.error_message}>
                                  {forward.error_message}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex justify-end">
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
