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
        <div className="max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm border border-blue-200 bg-blue-50/60">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" aria-hidden />
            <span className="font-medium text-zinc-900">
              {result.storeName} est en ligne
            </span>
          </div>
          <p className="text-zinc-600 text-xs mb-3">
            {result.productCount} produit{result.productCount > 1 ? 's' : ''} importé
            {result.productCount > 1 ? 's' : ''} · prêt à vendre
          </p>
          <a
            href={`/shop/${result.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
        <div className="max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm border border-rose-200 bg-rose-50/60">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden />
            <span className="font-medium text-zinc-900">Création interrompue</span>
          </div>
          <p className="text-xs text-zinc-600 whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    );
  }

  if (!running) return null;

  const recentLogs = logs.slice(-8);

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] w-full rounded-2xl rounded-tl-md px-4 py-3 text-sm border border-blue-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden />
          <span className="font-medium text-zinc-900 truncate">
            Création de {storeName || '…'}
          </span>
          <span className="ml-auto text-[11px] tabular-nums text-zinc-400 shrink-0">
            {percent}% · {elapsed}s
          </span>
        </div>
        {currentStep && (
          <p className="text-xs text-zinc-600 italic mb-2 truncate" title={currentStep}>
            {currentStep}
          </p>
        )}
        <div className="h-1 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
            aria-hidden
          />
        </div>
        {recentLogs.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] text-zinc-500 max-h-32 overflow-y-auto pr-1">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-start gap-2">
                <span className="text-zinc-300 mt-px shrink-0">·</span>
                <span className="break-words">{l.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
