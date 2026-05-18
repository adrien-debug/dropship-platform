'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useCallback, useEffect, useState } from 'react';
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

  const forward = useCallback(
    async (dryRun: boolean): Promise<ForwardResponse> => {
      const res = await apiFetch(`/api/agent/orders/${orderId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          ...(dryRun ? {} : { confirm: 'PLACE_REAL_ORDER' }),
        }),
      });
      return (await res.json()) as ForwardResponse;
    },
    [orderId],
  );

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
  }, [modalOpen, dryRunResult, dryRunning, forward]);

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
        className="px-3 py-1.5 text-xs rounded-md disabled:cursor-not-allowed"
        style={{
          background: alreadySent ? 'var(--ct-surface-1)' : 'var(--ct-surface-3)',
          color: alreadySent ? 'var(--ct-text-muted)' : 'var(--ct-text-primary)',
          border: '1px solid var(--ct-border)',
          transition: 'opacity var(--ct-dur-base) var(--ct-ease)',
        }}
        title={alreadySent ? 'Déjà envoyée à AliExpress' : 'Préparer et envoyer la commande AE'}
      >
        {alreadySent ? 'Envoyée' : 'Envoyer à AE'}
      </button>

      {sentResult && !modalOpen && (
        <div
          className="text-[11px] rounded-md px-2.5 py-1.5 max-w-[280px]"
          style={{
            background: sentResult.ok ? 'var(--ct-surface-2)' : 'var(--ct-surface-1)',
            border: `1px solid ${sentResult.ok ? 'var(--ct-border-accent)' : 'var(--ct-border)'}`,
            color: sentResult.ok ? 'var(--ct-accent-strong)' : 'var(--ct-text-muted)',
          }}
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
      {/* Backdrop */}
      <div
        style={{ background: 'rgba(26,5,11,0.65)', backdropFilter: 'blur(6px)' }}
        className="absolute inset-0"
        onClick={() => !sending && onClose()}
      />
      {/* Panel */}
      <div
        className="relative rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col"
        style={{
          background: 'var(--ct-surface-2)',
          border: '1px solid var(--ct-border-strong)',
          boxShadow: 'var(--ct-shadow-depth)',
        }}
      >
        <header
          className="px-5 py-4"
          style={{ borderBottom: '1px solid var(--ct-border)' }}
        >
          <h2
            id="forward-review-title"
            className="text-base font-semibold"
            style={{ color: 'var(--ct-text-primary)' }}
          >
            Vérifier la commande AliExpress
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--ct-text-muted)' }}>
            Cette commande sera créée chez AE en statut « En attente de paiement ». Tu paieras
            ensuite manuellement sur aliexpress.com.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sentResult?.ok && sentResult.status === 'sent' ? (
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: 'var(--ct-surface-1)',
                border: '1px solid var(--ct-border-accent)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--ct-accent-strong)' }}>
                Envoyée — AE #{sentResult.aeOrderId}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ct-text-body)' }}>
                Connecte-toi sur aliexpress.com pour finaliser le paiement.
              </p>
            </div>
          ) : sentResult?.status === 'error' ? (
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: 'var(--ct-surface-1)',
                border: '1px solid var(--ct-border)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--ct-text-primary)' }}>
                Erreur lors de l&apos;envoi
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ct-text-muted)' }}>
                {sentResult.error}
              </p>
            </div>
          ) : dryRunning ? (
            <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--ct-text-muted)' }}>
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--ct-accent)' }}
              />
              Préparation du payload AE…
            </div>
          ) : dryRunResult?.status === 'error' || !dryRunResult?.ok ? (
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: 'var(--ct-surface-1)',
                border: '1px solid var(--ct-border)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--ct-text-primary)' }}>
                Impossible de préparer la commande
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ct-text-muted)' }}>
                {dryRunResult?.error ?? 'Erreur inconnue'}
              </p>
            </div>
          ) : (
            <>
              {addr && (
                <Section title="Adresse de livraison">
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--ct-text-body)' }}>
                    {addr.full_name && (
                      <div className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>
                        {addr.full_name}
                      </div>
                    )}
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
                  <p className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>
                    Aucun produit mappable — envoi impossible.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono" style={{ color: 'var(--ct-text-muted)' }}>
                          {it.product_id}
                        </span>
                        <span style={{ color: 'var(--ct-text-faint)' }}>×{it.product_count}</span>
                        {it.sku_attr && (
                          <span className="font-mono" style={{ color: 'var(--ct-text-faint)' }}>
                            {it.sku_attr}
                          </span>
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
                      <li key={i} className="text-xs" style={{ color: 'var(--ct-text-body)' }}>
                        <div className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>
                          {u.title}
                        </div>
                        <div style={{ color: 'var(--ct-text-muted)' }}>{u.reason}</div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <footer
          className="px-5 py-4 flex items-center justify-end gap-2"
          style={{
            borderTop: '1px solid var(--ct-border)',
            background: 'var(--ct-surface-1)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{
              color: 'var(--ct-text-body)',
              transition: 'background var(--ct-dur-base) var(--ct-ease)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--ct-surface-3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {sentResult?.ok ? 'Fermer' : 'Annuler'}
          </button>
          {!sentResult?.ok && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canSend || sending || dryRunning}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
              style={{
                background: 'var(--ct-accent-strong)',
                color: 'var(--ct-text-strong)',
                transition: 'opacity var(--ct-dur-base) var(--ct-ease)',
                opacity: !canSend || sending || dryRunning ? 0.4 : 1,
              }}
            >
              {sending ? 'Envoi…' : "Confirmer l'envoi"}
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
        className="text-[10px] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{
          color: tone === 'warn' ? 'var(--ct-accent-strong)' : 'var(--ct-text-muted)',
        }}
      >
        {title}
      </h3>
      <div
        className="rounded-lg px-4 py-3"
        style={{
          border: `1px solid ${tone === 'warn' ? 'var(--ct-border-accent)' : 'var(--ct-border)'}`,
          background:
            tone === 'warn' ? 'var(--ct-accent-soft)' : 'var(--ct-surface-1)',
        }}
      >
        {children}
      </div>
    </section>
  );
}
