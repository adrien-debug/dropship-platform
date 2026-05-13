import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { runAnomalyWatch, type AnomalyWatchResult } from '@/lib/ops/anomaly-watch';

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

function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'amber' | 'emerald' | 'red';
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'text-zinc-900',
    amber: 'text-indigo-600',
    emerald: 'text-indigo-600',
    red: 'text-zinc-500',
  };
  return (
    <div className="border border-zinc-200 bg-zinc-50 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 text-kicker uppercase tracking-cta text-zinc-400 font-medium">
        <span className="inline-block w-1 h-1 rounded-full bg-ds-text-muted" />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${toneClasses[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

function StatusDot({ tone }: { tone: 'amber' | 'emerald' | 'blue' | 'red' | 'zinc' }) {
  const map: Record<string, string> = {
    amber: 'bg-[var(--warning-muted)]0',
    emerald: 'bg-[var(--success-muted)]0',
    blue: 'bg-[var(--info-muted)]0',
    red: 'bg-[var(--danger-muted)]0',
    zinc: 'bg-ds-text-muted',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${map[tone]}`} aria-hidden="true" />;
}

/**
 * Live snapshot of the order anomaly watcher cron (P1.3) — rendered at the
 * top of the orders page so the founder sees the same payload the daily GH
 * workflow does, without waiting for the issue to land.
 *
 * Why live and not snapshot-table: the queries are identical to ones the
 * page already runs (paid-orders join + forwards scan), no extra round-trip
 * to a separate cache, and the page is already `force-dynamic`. Adding a
 * `dropship_anomaly_snapshots` migration would buy us only one thing —
 * historical drift — which the GH issues already provide as a side-effect.
 */
function AnomalyPanel({ data }: { data: AnomalyWatchResult | { ok: false; error: string } }) {
  if (!data.ok) {
    return (
      <section className="border border-[var(--danger-muted)] bg-[var(--danger-muted)]/50 rounded-xl px-5 py-4 text-sm text-zinc-500">
        <div className="text-kicker uppercase tracking-cta text-zinc-500/70 font-medium mb-1">
          Surveillance commandes
        </div>
        Impossible de lancer le scan d&apos;anomalies : {data.error}
      </section>
    );
  }

  const { total, counts, stranded, stuck, errors, warnings, generated_at } = data;

  if (total === 0) {
    return (
      <section className="border border-[var(--success-muted)] bg-[var(--success-muted)]/40 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-kicker uppercase tracking-cta text-indigo-600/70 font-medium">
            Surveillance commandes · P1.3
          </div>
          <div className="mt-1 inline-flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success-muted)]0" />
              Aucune anomalie détectée
            </span>
            <span className="text-zinc-400">
              Stranded AE 15j+, Stripe→AE 4h+, erreurs 48h+ : tout est clean.
            </span>
          </div>
        </div>
        <div className="text-kicker text-indigo-600/70">
          Scanné{' '}
          {new Date(generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-indigo-200 bg-[var(--warning-muted)]/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--warning-muted)]/60 bg-[var(--warning-muted)]/60 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-kicker uppercase tracking-cta text-indigo-600/70 font-medium">
            Surveillance commandes · P1.3
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-indigo-600">
            <strong>{total}</strong> anomalie{total > 1 ? 's' : ''} à <em className="italic">trier</em>
          </h3>
        </div>
        <div className="text-kicker text-indigo-600/70">
          Scanné{' '}
          {new Date(generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-amber-200/60">
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-indigo-600">Stranded AE</div>
            <div className="text-2xl font-semibold tracking-tight text-indigo-600">{counts.stranded}</div>
          </div>
          <div className="mt-0.5 text-kicker text-indigo-600/70">
            sent + impayé &gt; 15 jours
          </div>
          {stranded.slice(0, 3).map((r) => (
            <div key={r.medusa_order_id} className="mt-2 text-xs text-zinc-600">
              <a
                href={aliExpressOrderUrl(r.ae_order_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-orange-700 hover:underline"
              >
                {r.ae_order_id}
              </a>
              <span className="text-zinc-400"> · {r.age_days}j</span>
            </div>
          ))}
          {counts.stranded > 3 && (
            <div className="mt-1 text-kicker text-indigo-600/70">
              + {counts.stranded - 3} de plus
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-indigo-600">Stripe → AE</div>
            <div className="text-2xl font-semibold tracking-tight text-indigo-600">{counts.stuck}</div>
          </div>
          <div className="mt-0.5 text-kicker text-indigo-600/70">
            payé Stripe, pas de forward &gt; 4h
          </div>
          {stuck.slice(0, 3).map((r) => (
            <div key={r.medusa_order_id} className="mt-2 text-xs text-zinc-600">
              <span className="font-medium">
                #{r.display_id ?? r.medusa_order_id.slice(0, 8)}
              </span>
              <span className="text-zinc-400"> · {r.age_hours}h</span>
              {r.email && <span className="text-zinc-400"> · {r.email}</span>}
            </div>
          ))}
          {counts.stuck > 3 && (
            <div className="mt-1 text-kicker text-indigo-600/70">
              + {counts.stuck - 3} de plus
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-indigo-600">Erreurs</div>
            <div className="text-2xl font-semibold tracking-tight text-indigo-600">{counts.errors}</div>
          </div>
          <div className="mt-0.5 text-kicker text-indigo-600/70">
            forwards en erreur &gt; 48h
          </div>
          {errors.slice(0, 3).map((r) => (
            <div key={r.medusa_order_id} className="mt-2 text-xs text-zinc-600">
              <div className="font-mono text-zinc-600 truncate">
                {r.medusa_order_id.slice(0, 18)}…
              </div>
              {r.error_message && (
                <div className="text-zinc-400 truncate" title={r.error_message}>
                  {r.error_message}
                </div>
              )}
            </div>
          ))}
          {counts.errors > 3 && (
            <div className="mt-1 text-kicker text-indigo-600/70">
              + {counts.errors - 3} de plus
            </div>
          )}
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="px-5 py-2 border-t border-[var(--warning-muted)]/60 bg-indigo-50/40 text-kicker text-indigo-600/80">
          {warnings.join(' · ')}
        </div>
      )}
    </section>
  );
}

export default async function OrdersPage() {
  let orders: Awaited<ReturnType<typeof medusa.getOrders>>['orders'] = [];
  let fetchError: string | null = null;
  try {
    const res = await medusa.getOrders({ limit: 50 });
    orders = res.orders;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Unknown error';
  }

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

  // "À payer" : forwards live envoyés à AE, pas encore marqués payés. Indépendant
  // de la fenêtre des 50 dernières commandes Medusa au-dessus — on remonte tout
  // ce qui dort en awaiting_payment, peu importe son ancienneté (AE annule au
  // bout de 20 jours).
  const { rows: awaitingRaw } = await getDbRead().query<{
    medusa_order_id: string;
    ae_order_id: string;
    created_at: string;
  }>(
    `SELECT medusa_order_id, ae_order_id, created_at
       FROM dropship_order_forwards
      WHERE status = 'sent' AND dry_run = false AND paid_at IS NULL
        AND ae_order_id IS NOT NULL
      ORDER BY created_at ASC`,
  );

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

  // P1.3 anomaly snapshot — runs the same queries the daily cron does, live.
  // Best-effort: a scan failure must not blank the orders page.
  let anomalyData: AnomalyWatchResult | { ok: false; error: string };
  try {
    anomalyData = await runAnomalyWatch();
  } catch (e) {
    anomalyData = { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
            Production · Dropship
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Carnet de <em className="italic text-zinc-600">commandes</em>
          </h2>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Forward chaque commande payée vers AliExpress. Le <strong>dry-run</strong> sauve le payload sans rien envoyer ;{' '}
            <strong>envoyer à AE</strong> place une vraie commande dropshipping qu&apos;il faudra payer sur aliexpress.com.
          </p>
        </div>
        <DryRunPendingButton />
      </header>

      <AnomalyPanel data={anomalyData} />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Commandes payées" value={String(stats.paidOrders)} hint="Sur les 50 dernières" />
        <StatCard
          label="À payer chez AE"
          value={String(stats.awaitingPayment)}
          hint={
            stats.awaitingPayment > 0 && awaitingCurrency
              ? `Total client : ${formatMoney(awaitingTotal, awaitingCurrency)}`
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
        <div className="border border-[var(--danger-muted)] bg-[var(--danger-muted)] rounded-xl p-4 text-sm text-zinc-500">
          Erreur Medusa : {fetchError}
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <section className="border border-[var(--warning-muted)] bg-[var(--warning-muted)]/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--warning-muted)]/60 bg-[var(--warning-muted)]/60">
            <div className="flex items-baseline gap-3">
              <h3 className="text-base font-semibold tracking-tight text-indigo-600">
                À payer <em className="italic">chez AliExpress</em>
              </h3>
              <span className="text-xs uppercase tracking-wider text-indigo-600/70">
                · {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1 text-xs text-indigo-600/80 max-w-3xl">
              AliExpress n&apos;a pas d&apos;API de paiement. Clique le lien pour ouvrir la commande sur ton compte AE,
              paie, puis reviens cliquer <strong>Marquer payée</strong>. Annulation automatique après{' '}
              <strong>20 jours</strong> sans paiement.
            </p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-[var(--warning-muted)]/40 text-kicker uppercase tracking-header text-indigo-600/60">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Commande</th>
                <th className="text-left px-5 py-3 font-medium">Client</th>
                <th className="text-left px-5 py-3 font-medium">Total client</th>
                <th className="text-left px-5 py-3 font-medium">Order AE</th>
                <th className="text-left px-5 py-3 font-medium">Forwardée</th>
                <th className="text-right px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40">
              {awaitingPayment.map((row) => {
                const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                const ageHours = Math.floor(ageMs / 3_600_000);
                const ageLabel =
                  ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                const stale = ageHours >= 24 * 15;
                return (
                  <tr key={row.medusa_order_id} className="hover:bg-[var(--warning-muted)]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium">
                        #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                      </div>
                      <div className="text-kicker text-zinc-400 font-mono mt-0.5">{row.medusa_order_id}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{row.customer_email ?? '—'}</td>
                    <td className="px-5 py-4 font-semibold tracking-tight text-base">
                      {row.total_minor != null && row.currency_code
                        ? formatMoney(row.total_minor, row.currency_code)
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={aliExpressOrderUrl(row.ae_order_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900 underline underline-offset-4 decoration-orange-300 hover:decoration-orange-500 font-mono text-xs"
                      >
                        {row.ae_order_id}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </td>
                    <td className={`px-5 py-4 text-xs ${stale ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      <div className="flex items-center gap-2">
                        <StatusDot tone={stale ? 'red' : 'amber'} />
                        il y a {ageLabel}
                      </div>
                      {stale && <div className="mt-0.5 text-kicker font-medium">proche annulation AE</div>}
                    </td>
                    <td className="px-5 py-4 text-right">
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
        <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-16 text-center bg-zinc-50/40">
          <p className="text-sm font-semibold tracking-tight text-zinc-600">Aucune commande pour le moment.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <section className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50">
          <div className="px-5 py-4 border-b border-zinc-200/60 flex items-baseline gap-3">
            <h3 className="text-base font-semibold tracking-tight">
              Toutes les <em className="italic text-zinc-600">commandes</em>
            </h3>
            <span className="text-xs uppercase tracking-wider text-zinc-400">
              · {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-zinc-50/60 text-kicker uppercase tracking-header text-zinc-400">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Commande</th>
                <th className="text-left px-5 py-3 font-medium">Client</th>
                <th className="text-left px-5 py-3 font-medium">Total</th>
                <th className="text-left px-5 py-3 font-medium">Paiement</th>
                <th className="text-left px-5 py-3 font-medium">AliExpress</th>
                <th className="text-right px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.map((order) => {
                const forward = forwardsByOrder.get(order.id) ?? null;
                const sent = forward?.status === 'sent';
                const paymentOk =
                  order.payment_status === 'captured' || order.payment_status === 'authorized';
                return (
                  <tr key={order.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium">#{order.display_id ?? order.id.slice(0, 8)}</div>
                      <div className="text-kicker text-zinc-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-zinc-600">{order.email ?? '—'}</div>
                      {order.shipping_address?.city && (
                        <div className="text-xs text-zinc-400 mt-0.5">{order.shipping_address.city}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatMoney(order.total, order.currency_code)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${paymentOk ? 'text-indigo-600' : 'text-zinc-400'}`}
                      >
                        <StatusDot tone={paymentOk ? 'emerald' : 'zinc'} />
                        {order.payment_status ?? order.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {forward ? (
                        forward.status === 'sent' && forward.ae_order_id ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs ${forward.paid_at ? 'text-indigo-600' : 'text-indigo-600'}`}
                            >
                              <StatusDot tone={forward.paid_at ? 'emerald' : 'amber'} />
                              {forward.paid_at ? 'payée' : 'à payer'}
                            </span>
                            <a
                              href={aliExpressOrderUrl(forward.ae_order_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-kicker text-zinc-400 hover:text-orange-700 hover:underline underline-offset-2"
                            >
                              {forward.ae_order_id}
                            </a>
                          </div>
                        ) : forward.status === 'dry_run' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--info)]">
                            <StatusDot tone="blue" />
                            dry-run prêt
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5 max-w-[260px]">
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                              <StatusDot tone="red" />
                              erreur
                            </span>
                            {forward.error_message && (
                              <span className="text-kicker text-zinc-500/80 line-clamp-2" title={forward.error_message}>
                                {forward.error_message}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
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
