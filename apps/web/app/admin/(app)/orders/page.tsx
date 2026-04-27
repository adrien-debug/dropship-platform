import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { formatMoney } from '@/lib/medusa-store';

export const dynamic = 'force-dynamic';

interface ForwardSummary {
  medusa_order_id: string;
  status: string;
  ae_order_id: string | null;
  dry_run: boolean;
  error_message: string | null;
  created_at: string;
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
    const { rows } = await getDb().query<ForwardSummary>(
      `SELECT DISTINCT ON (medusa_order_id)
              medusa_order_id, status, ae_order_id, dry_run, error_message, created_at
         FROM dropship_order_forwards
        WHERE medusa_order_id IN (${placeholders})
        ORDER BY medusa_order_id, created_at DESC`,
      ids,
    );
    forwardsByOrder = new Map(rows.map((r) => [r.medusa_order_id, r]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Commandes</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Forward chaque commande payée vers AliExpress. <strong>Dry-run</strong> sauve la payload sans rien envoyer ;{' '}
          <strong>Envoyer à AE</strong> place une vraie commande dropshipping.
        </p>
      </div>

      {fetchError && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-800">
          Erreur Medusa : {fetchError}
        </div>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">Aucune commande pour le moment.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Commande</th>
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Paiement</th>
                <th className="text-left px-4 py-3 font-medium">Forwarding</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.map((order) => {
                const forward = forwardsByOrder.get(order.id) ?? null;
                const sent = forward?.status === 'sent';
                return (
                  <tr key={order.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">#{order.display_id ?? order.id.slice(0, 8)}</div>
                      <div className="text-xs text-zinc-400">{new Date(order.created_at).toLocaleDateString('fr-FR')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{order.email ?? '—'}</div>
                      {order.shipping_address?.city && (
                        <div className="text-xs text-zinc-400">{order.shipping_address.city}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatMoney(order.total, order.currency_code)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          order.payment_status === 'captured' || order.payment_status === 'authorized'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {order.payment_status ?? order.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {forward ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            forward.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : forward.status === 'dry_run'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                          title={forward.error_message ?? undefined}
                        >
                          {forward.status === 'sent' && `✅ AE #${forward.ae_order_id}`}
                          {forward.status === 'dry_run' && '🧪 dry-run'}
                          {forward.status === 'error' && '❌ erreur'}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
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
      )}
    </div>
  );
}
