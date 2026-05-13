'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  alreadySent: boolean;
}

interface ForwardPayload {
  logistics_address?: {
    full_name?: string;
    address?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  product_items?: { product_id: string; product_count: number; sku_attr?: string }[];
}

interface ForwardResponse {
  ok: boolean;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;
  aeOrderId?: string;
  error?: string;
  unmappedItems?: { itemId: string; title: string; reason: string }[];
  payload?: ForwardPayload;
}

export function ForwardButton({ orderId, alreadySent }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ForwardResponse | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<ForwardResponse | null>(null);

  async function forward(dryRun: boolean): Promise<ForwardResponse> {
    const res = await apiFetch(`/api/agent/orders/${orderId}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun,
        ...(dryRun ? {} : { confirm: 'PLACE_REAL_ORDER' }),
      }),
    });
    return (await res.json()) as ForwardResponse;
  }

  // Auto-run dry-run when the modal opens.
  useEffect(() => {
    if (!modalOpen || dryRunResult || dryRunning) return;
    setDryRunning(true);
    forward(true)
      .then((r) => setDryRunResult(r))
      .catch((e) =>
        setDryRunResult({
          ok: false,
          status: 'error',
          forwardId: '',
          error: e instanceof Error ? e.message : 'Network error',
        }),
      )
      .finally(() => setDryRunning(false));
  }, [modalOpen, dryRunResult, dryRunning]);

  function openModal() {
    setDryRunResult(null);
    setSentResult(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function confirmSend() {
    setSending(true);
    try {
      const r = await forward(false);
      setSentResult(r);
      if (r.ok) router.refresh();
    } catch (e) {
      setSentResult({
        ok: false,
        status: 'error',
        forwardId: '',
        error: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    dryRunResult?.ok &&
    dryRunResult.status === 'dry_run' &&
    (dryRunResult.payload?.product_items?.length ?? 0) > 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={openModal}
        disabled={alreadySent}
        className="px-3 py-1.5 text-xs rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
        title={alreadySent ? 'Déjà envoyée à AliExpress' : 'Préparer et envoyer la commande AE'}
      >
        {alreadySent ? 'Envoyée' : 'Envoyer à AE'}
      </button>

      {sentResult && !modalOpen && (
        <div
          className={`text-[11px] rounded-md px-2.5 py-1.5 border max-w-[280px] ${
            sentResult.ok
              ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
              : 'bg-zinc-50 border-zinc-200 text-zinc-500'
          }`}
        >
          {sentResult.status === 'sent' && `Envoyée — AE #${sentResult.aeOrderId}`}
          {sentResult.status === 'error' && (sentResult.error ?? 'Erreur inconnue')}
        </div>
      )}

      {modalOpen && (
        <ReviewModal
          dryRunning={dryRunning}
          dryRunResult={dryRunResult}
          sending={sending}
          sentResult={sentResult}
          canSend={!!canSend}
          onClose={closeModal}
          onConfirm={confirmSend}
        />
      )}
    </div>
  );
}

function ReviewModal({
  dryRunning,
  dryRunResult,
  sending,
  sentResult,
  canSend,
  onClose,
  onConfirm,
}: {
  dryRunning: boolean;
  dryRunResult: ForwardResponse | null;
  sending: boolean;
  sentResult: ForwardResponse | null;
  canSend: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, sending]);

  const addr = dryRunResult?.payload?.logistics_address;
  const items = dryRunResult?.payload?.product_items ?? [];
  const unmapped = dryRunResult?.unmappedItems ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
        onClick={() => !sending && onClose()}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col border border-zinc-200">
        <header className="px-5 py-4 border-b border-zinc-200">
          <h2 id="forward-review-title" className="text-base font-semibold text-zinc-900">
            Vérifier la commande AliExpress
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cette commande sera créée chez AE en statut « En attente de paiement ». Tu paieras
            ensuite manuellement sur aliexpress.com.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sentResult?.ok && sentResult.status === 'sent' ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p className="text-sm font-medium text-indigo-700">
                Envoyée — AE #{sentResult.aeOrderId}
              </p>
              <p className="mt-1 text-xs text-indigo-600">
                Connecte-toi sur aliexpress.com pour finaliser le paiement.
              </p>
            </div>
          ) : sentResult?.status === 'error' ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-sm font-medium text-zinc-700">Erreur lors de l&apos;envoi</p>
              <p className="mt-1 text-xs text-zinc-500">{sentResult.error}</p>
            </div>
          ) : dryRunning ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Préparation du payload AE…
            </div>
          ) : dryRunResult?.status === 'error' || !dryRunResult?.ok ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-sm font-medium text-zinc-700">Impossible de préparer la commande</p>
              <p className="mt-1 text-xs text-zinc-500">{dryRunResult?.error ?? 'Erreur inconnue'}</p>
            </div>
          ) : (
            <>
              {addr && (
                <Section title="Adresse de livraison">
                  <div className="text-sm text-zinc-700 leading-relaxed">
                    {addr.full_name && <div className="font-medium">{addr.full_name}</div>}
                    {addr.address && <div>{addr.address}</div>}
                    <div>
                      {[addr.zip, addr.city].filter(Boolean).join(' ')}
                      {addr.country && ` · ${addr.country.toUpperCase()}`}
                    </div>
                  </div>
                </Section>
              )}

              <Section title={`Produits AE (${items.length})`}>
                {items.length === 0 ? (
                  <p className="text-xs text-zinc-500">Aucun produit mappable — envoi impossible.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-zinc-500">{it.product_id}</span>
                        <span className="text-zinc-400">×{it.product_count}</span>
                        {it.sku_attr && (
                          <span className="text-zinc-400 font-mono">{it.sku_attr}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {unmapped.length > 0 && (
                <Section title={`Items non mappés (${unmapped.length})`} tone="warn">
                  <ul className="space-y-1.5">
                    {unmapped.map((u, i) => (
                      <li key={i} className="text-xs text-zinc-700">
                        <div className="font-medium">{u.title}</div>
                        <div className="text-zinc-500">{u.reason}</div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {sentResult?.ok ? 'Fermer' : 'Annuler'}
          </button>
          {!sentResult?.ok && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canSend || sending || dryRunning}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Envoi…' : 'Confirmer l’envoi'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tone = 'default',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'warn';
}) {
  return (
    <section>
      <h3
        className={`text-[10px] uppercase tracking-[0.12em] font-semibold mb-2 ${
          tone === 'warn' ? 'text-amber-600' : 'text-zinc-400'
        }`}
      >
        {title}
      </h3>
      <div
        className={`rounded-lg border px-4 py-3 ${
          tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'
        }`}
      >
        {children}
      </div>
    </section>
  );
}
