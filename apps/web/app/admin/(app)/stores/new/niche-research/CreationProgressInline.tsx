import type { CreationProgress } from './types';

/**
 * Inline progress card rendered inside the chat scroll area while the
 * parent's create-store SSE stream is alive. Three modes:
 *   - running → live spinner, current step, progress bar, step log
 *   - result  → success banner with "Ouvrir le store" CTA
 *   - error   → red banner with the error message
 */
export function CreationProgressInline({ progress }: { progress: CreationProgress }) {
  const { running, percent, elapsed, currentStep, logs, result, error, storeName } = progress;

  if (result) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm" style={{ border: '1px solid var(--ct-border-accent)', background: 'var(--ct-accent-soft)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ct-accent)' }} aria-hidden />
            <span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>
              {result.storeName} est en ligne
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--ct-text-body)' }}>
            {result.productCount} produit{result.productCount > 1 ? 's' : ''} importé
            {result.productCount > 1 ? 's' : ''} · prêt à vendre
          </p>
          <a
            href={`/shop/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            className="ct-seg-btn primary inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
          >
            Ouvrir le store →
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm" style={{ border: '1px solid var(--ct-border-accent)', background: 'var(--ct-accent-soft)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ct-accent-strong)' }} aria-hidden />
            <span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Création interrompue</span>
          </div>
          <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--ct-text-body)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!running) return null;

  const recentLogs = logs.slice(-8);

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] w-full rounded-2xl rounded-tl-md px-4 py-3 text-sm" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)', boxShadow: 'var(--ct-shadow-depth)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--ct-accent)' }} aria-hidden />
          <span className="font-medium truncate" style={{ color: 'var(--ct-text-primary)' }}>
            Création de {storeName || '…'}
          </span>
          <span className="ml-auto text-[11px] tabular-nums shrink-0" style={{ color: 'var(--ct-text-muted)' }}>
            {percent}% · {elapsed}s
          </span>
        </div>
        {currentStep && (
          <p className="text-xs italic mb-2 truncate" style={{ color: 'var(--ct-text-body)' }} title={currentStep}>
            {currentStep}
          </p>
        )}
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--ct-surface-3)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%`, background: 'var(--ct-accent)' }}
            aria-hidden
          />
        </div>
        {recentLogs.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] max-h-32 overflow-y-auto pr-1" style={{ color: 'var(--ct-text-body)' }}>
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-start gap-2">
                <span className="mt-px shrink-0" style={{ color: 'var(--ct-border-strong)' }}>·</span>
                <span className="break-words">{l.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
